/**
 * The look pipeline: decode → (relight with the model → verify → detail lock) → render → encode.
 *
 * Only the relight step is generative, and its output is accepted only if its structure matches
 * the input; even then only its large-scale light survives, because the detail lock puts the
 * original's edges and textures back. The render step is deterministic pixel math.
 */
import { generateImage, nearestAspectRatio, type ImageSize, type ThinkingLevel } from './gemini.js';
import { LOOKS, type LookSpec } from './looks.js';
import { BOOTH_STRIP_PROMPT, buildRelightPrompt } from './relight.js';
import { detailLock, edgeEnergy, verify, type Verification } from './render/lock.js';
import { decode, encodeJpeg, fitCover, type Img } from './render/pixels.js';

export type RunOptions = {
  apiKey?: string;
  model: string;
  fallbackModels?: string[];
  imageSize?: ImageSize;
  thinkingLevel?: ThinkingLevel;
  /** Absolute ms deadline for the whole run. */
  deadline: number;
  strength?: number;
  /** Set false to skip the model entirely (bench runs, offline tests). */
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
  /** Model that produced the relight, or 'none' for pure rendering. */
  model: string;
  relit: boolean;
  /** True when the relight was rejected and the deterministic approximation was used. */
  fallback: boolean;
  verification?: Verification;
  attempts: number;
  ms: number;
  stages: string[];
};

/** Inputs with less edge energy than this are flat colour; there is nothing to relight. */
const FLAT_INPUT_ENERGY = 0.004;
/** A retry is only started with this much of the deadline left. */
const MIN_RETRY_BUDGET_MS = 24_000;

export function getLook(lookId: string): LookSpec | undefined {
  return LOOKS[lookId];
}

export async function runLook(lookId: string, input: { mimeType: string; data: Buffer }, opts: RunOptions): Promise<RunResult> {
  const started = Date.now();
  const look = LOOKS[lookId];
  if (!look) throw Object.assign(new Error(`Unknown look "${lookId}"`), { status: 400 });
  const stages: string[] = [];
  const seed = seedFrom(input.data);
  const original = await decode(input.data, opts.maxEdge ?? 2048);
  stages.push(`decode ${original.width}x${original.height}`);

  if (look.framing === 'free') return runFreeFormat(look, input, original, opts, seed, started, stages);

  let working: Img = original;
  let model = 'none';
  let relit = false;
  let fallback = false;
  let verification: Verification | undefined;
  let attempts = 0;

  if (look.relight && opts.allowRelight !== false && opts.apiKey) {
    const energy = await edgeEnergy(original);
    if (energy < FLAT_INPUT_ENERGY) {
      stages.push('flat input, relight skipped');
    } else {
      const prompt = buildRelightPrompt(look.relight, { strength: opts.strength });
      let accepted: Img | undefined;
      for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
        if (attempt > 0 && opts.deadline - Date.now() < MIN_RETRY_BUDGET_MS) { stages.push('no budget for retry'); break; }
        attempts++;
        let out;
        try {
          out = await generateImage({
            apiKey: opts.apiKey,
            model: opts.model,
            fallbackModels: opts.fallbackModels,
            image: { mimeType: input.mimeType, data: input.data.toString('base64') },
            prompt: attempt === 0 ? prompt : buildRelightPrompt(look.relight, { strength: opts.strength, strict: true }),
            imageSize: opts.imageSize,
            thinkingLevel: opts.thinkingLevel,
            aspectRatio: nearestAspectRatio(original.width, original.height),
            deadline: opts.deadline,
          });
        } catch (error) {
          // A failed first attempt surfaces (the app retries on busy); a failed retry falls back so
          // the user still gets a photo inside the time budget.
          if (attempt === 0) throw error;
          stages.push(`retry failed: ${(error as Error).message.slice(0, 80)}`);
          break;
        }
        model = out.model;
        const candidate = await fitCover(await decode(Buffer.from(out.data, 'base64')), original.width, original.height);
        verification = await verify(original, candidate);
        const ok = verification.aligned >= look.verify.aligned && verification.added <= look.verify.added;
        stages.push(`relight ${attempt + 1} ${model} aligned=${verification.aligned.toFixed(2)} added=${verification.added.toFixed(2)} edges=${verification.edges.toFixed(2)} ${ok ? 'accepted' : 'rejected'}`);
        if (opts.onCandidate) await opts.onCandidate({ attempt, jpeg: await encodeJpeg(candidate, 88), verification, accepted: ok });
        if (ok) accepted = candidate;
      }
      if (accepted) {
        working = detailLock(accepted, original, look.lock);
        relit = true;
        stages.push('detail lock');
      } else {
        working = await look.fallback({ width: original.width, height: original.height, data: new Float32Array(original.data) }, seed);
        fallback = true;
        stages.push('fallback relight');
      }
    }
  } else if (look.relight) {
    working = await look.fallback({ width: original.width, height: original.height, data: new Float32Array(original.data) }, seed);
    fallback = true;
    stages.push('relight disabled, fallback');
  }

  if (working === original) working = { width: original.width, height: original.height, data: new Float32Array(original.data) };
  const rendered = await look.render(working, seed);
  stages.push('render');
  const jpeg = await encodeJpeg(rendered, opts.jpegQuality ?? 92);
  return { jpeg, width: rendered.width, height: rendered.height, model, relit, fallback, verification, attempts, ms: Date.now() - started, stages };
}

async function runFreeFormat(look: LookSpec, input: { mimeType: string; data: Buffer }, original: Img, opts: RunOptions, seed: number, started: number, stages: string[]): Promise<RunResult> {
  if (opts.allowRelight === false || !opts.apiKey) {
    const rendered = await look.render({ width: original.width, height: original.height, data: new Float32Array(original.data) }, seed);
    const jpeg = await encodeJpeg(rendered, opts.jpegQuality ?? 92);
    return { jpeg, width: rendered.width, height: rendered.height, model: 'none', relit: false, fallback: true, attempts: 0, ms: Date.now() - started, stages: [...stages, 'free format without model'] };
  }
  const out = await generateImage({
    apiKey: opts.apiKey,
    model: opts.model,
    fallbackModels: opts.fallbackModels,
    image: { mimeType: input.mimeType, data: input.data.toString('base64') },
    prompt: BOOTH_STRIP_PROMPT,
    imageSize: opts.imageSize,
    thinkingLevel: opts.thinkingLevel,
    freeFraming: true,
    deadline: opts.deadline,
  });
  const generated = await decode(Buffer.from(out.data, 'base64'), opts.maxEdge ?? 2048);
  const rendered = await look.render(generated, seed);
  const jpeg = await encodeJpeg(rendered, opts.jpegQuality ?? 92);
  return { jpeg, width: rendered.width, height: rendered.height, model: out.model, relit: true, fallback: false, attempts: 1, ms: Date.now() - started, stages: [...stages, `generate ${out.model}`, 'render'] };
}

/** A stable seed from the input bytes so the same photo renders the same grain every time. */
function seedFrom(bytes: Buffer): number {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) h = Math.imul(h ^ bytes[i], 16777619);
  return h >>> 0;
}
