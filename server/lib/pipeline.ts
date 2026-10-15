/**
 * The look pipeline: decode → model renders the look → verify → identity anchor → encode.
 *
 * The model produces the whole photograph as the described camera would have. Its output is
 * accepted only if its structure matches the input (frame aligned, no new edges); the anchor then
 * pins faces, outlines and lettering to the original pixels while keeping the model's rendering in
 * flat areas. A rejected result is retried once with a stricter prompt and otherwise replaced by a
 * deterministic fallback, so a user never receives an invented photo.
 */
import { generateImage, nearestAspectRatio, type ImageSize, type ThinkingLevel } from './gemini.js';
import { LOOKS, type LookSpec } from './looks.js';
import { buildPrompt } from './relight.js';
import { anchor, edgeEnergy, verify, type Verification } from './render/lock.js';
import { decode, encodeJpeg, fitCover, type Img } from './render/pixels.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REFS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'refs');
const refCache = new Map<string, { mimeType: string; data: string }>();

function loadReference(file: string | undefined): { mimeType: string; data: string }[] | undefined {
  if (!file) return undefined;
  let ref = refCache.get(file);
  if (!ref) {
    const full = path.join(REFS_DIR, file);
    if (!fs.existsSync(full)) return undefined;
    ref = { mimeType: 'image/jpeg', data: fs.readFileSync(full).toString('base64') };
    refCache.set(file, ref);
  }
  return [ref];
}

export type RunOptions = {
  apiKey?: string;
  model: string;
  fallbackModels?: string[];
  imageSize?: ImageSize;
  thinkingLevel?: ThinkingLevel;
  /** Absolute ms deadline for the whole run. */
  deadline: number;
  strength?: number;
  /** Set false to skip the model entirely (offline tests). */
  allowRelight?: boolean;
  /** Decoded long-edge cap. The app uploads 1536; anything larger is reduced. */
  maxEdge?: number;
  jpegQuality?: number;
  /** Receives every raw model candidate with its scores (bench calibration). */
  onCandidate?: (info: { attempt: number; jpeg: Buffer; verification: Verification; accepted: boolean }) => Promise<void> | void;
};

export type RunResult = {
  jpeg: Buffer;
  width: number;
  height: number;
  model: string;
  relit: boolean;
  /** True when the model's result was rejected (or unavailable) and the deterministic fallback was used. */
  fallback: boolean;
  verification?: Verification;
  attempts: number;
  ms: number;
  stages: string[];
};

/** Inputs with less edge energy than this are flat colour; there is nothing to render. */
const FLAT_INPUT_ENERGY = 0.004;
/** A retry is only started with this much of the deadline left. */
const MIN_RETRY_BUDGET_MS = 24_000;

/** Ids used by earlier app builds, kept so an installed app keeps working after a lineup change. */
const ALIASES: Record<string, string> = {
  'point-and-shoot': 'day-flash',
  'after-dark': 'night-flash',
  rouge: 'red-flash',
  'y2k-compact': 'y2k-digicam',
  haze: 'glow',
  'bedroom-webcam': 'webcam',
};

export function resolveLookId(lookId: string): string {
  return ALIASES[lookId] ?? lookId;
}

export function getLook(lookId: string): LookSpec | undefined {
  return LOOKS[resolveLookId(lookId)];
}

function copy(img: Img): Img {
  return { width: img.width, height: img.height, data: new Float32Array(img.data) };
}

export async function runLook(requestedLookId: string, input: { mimeType: string; data: Buffer }, opts: RunOptions): Promise<RunResult> {
  const started = Date.now();
  const lookId = resolveLookId(requestedLookId);
  const look = LOOKS[lookId];
  if (!look) throw Object.assign(new Error(`Unknown look "${lookId}"`), { status: 400 });
  const stages: string[] = [];
  const seed = seedFrom(input.data);
  const original = await decode(input.data, opts.maxEdge ?? 2048);
  stages.push(`decode ${original.width}x${original.height}`);
  const quality = opts.jpegQuality ?? 92;

  const useModel = opts.allowRelight !== false && Boolean(opts.apiKey);

  if (look.framing === 'free') {
    if (!useModel) {
      const rendered = await look.fallback(copy(original), seed);
      return { jpeg: await encodeJpeg(rendered, quality), width: rendered.width, height: rendered.height, model: 'none', relit: false, fallback: true, attempts: 0, ms: Date.now() - started, stages: [...stages, 'free format without model'] };
    }
    const out = await generateImage({
      apiKey: opts.apiKey!, model: opts.model, fallbackModels: opts.fallbackModels,
      image: { mimeType: input.mimeType, data: input.data.toString('base64') },
      prompt: buildPrompt(lookId, { strength: opts.strength }),
      imageSize: opts.imageSize, thinkingLevel: opts.thinkingLevel, freeFraming: true, deadline: opts.deadline,
    });
    const generated = await decode(Buffer.from(out.data, 'base64'), opts.maxEdge ?? 2048);
    return { jpeg: await encodeJpeg(generated, quality), width: generated.width, height: generated.height, model: out.model, relit: true, fallback: false, attempts: 1, ms: Date.now() - started, stages: [...stages, `generate ${out.model}`] };
  }

  let model = 'none';
  let verification: Verification | undefined;
  let attempts = 0;
  let accepted: Img | undefined;

  if (useModel) {
    const energy = await edgeEnergy(original);
    if (energy < FLAT_INPUT_ENERGY) {
      stages.push('flat input, model skipped');
    } else {
      const references = loadReference(look.reference);
      if (references) stages.push('reference attached');
      for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
        if (attempt > 0 && opts.deadline - Date.now() < MIN_RETRY_BUDGET_MS) { stages.push('no budget for retry'); break; }
        attempts++;
        let out;
        try {
          out = await generateImage({
            apiKey: opts.apiKey!, model: opts.model, fallbackModels: opts.fallbackModels,
            image: { mimeType: input.mimeType, data: input.data.toString('base64') },
            references,
            prompt: buildPrompt(lookId, { strength: opts.strength, strict: attempt > 0, reference: Boolean(references) }),
            imageSize: opts.imageSize, thinkingLevel: opts.thinkingLevel,
            aspectRatio: nearestAspectRatio(original.width, original.height), deadline: opts.deadline,
          });
        } catch (error) {
          // A failed first attempt surfaces (the app retries on busy); a failed retry falls back.
          if (attempt === 0) throw error;
          stages.push(`retry failed: ${(error as Error).message.slice(0, 80)}`);
          break;
        }
        model = out.model;
        const candidate = await fitCover(await decode(Buffer.from(out.data, 'base64')), original.width, original.height);
        verification = await verify(original, candidate);
        const ok = verification.aligned >= look.verify.aligned && verification.added <= look.verify.added;
        stages.push(`model ${attempt + 1} ${model} aligned=${verification.aligned.toFixed(2)} added=${verification.added.toFixed(2)} ${ok ? 'accepted' : 'rejected'}`);
        if (opts.onCandidate) await opts.onCandidate({ attempt, jpeg: await encodeJpeg(candidate, 88), verification, accepted: ok });
        if (ok) accepted = candidate;
      }
    }
  }

  let result: Img;
  let fallback = false;
  if (accepted) {
    result = anchor(accepted, original, look.anchor);
    stages.push('anchor');
    if (look.finish) { result = await look.finish(result, seed); stages.push('finish'); }
  } else {
    result = await look.fallback(copy(original), seed);
    fallback = true;
    stages.push('fallback');
  }
  const jpeg = await encodeJpeg(result, quality);
  return { jpeg, width: result.width, height: result.height, model, relit: Boolean(accepted), fallback, verification, attempts, ms: Date.now() - started, stages };
}

/** A stable seed from the input bytes so the same photo renders the same fallback every time. */
function seedFrom(bytes: Buffer): number {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) h = Math.imul(h ^ bytes[i], 16777619);
  return h >>> 0;
}
