/**
 * The generation call. Prepares the photo, posts it to the Exposure API, and returns local uris
 * for the result and the normalised source. With no API URL configured (web preview, early dev)
 * it runs a simulated pass so the rest of the flow is still exercisable.
 */

import { getLook } from '@/data/looks';
import { getUserId } from '@/lib/purchases';
import { ImageReadError, makeThumbnail, matchFraming, persistEncoded, prepareForUpload } from '@/lib/image-io';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN;

/** The whole round trip, including a busy retry, must finish inside this. */
const CLIENT_TIMEOUT_MS = 95_000;
/** How long after the upload starts we assume the model is working (the response only arrives at the end). */
const GENERATING_AFTER_MS = 1_200;
const BUSY_RETRY_DELAY_MS = 3_000;

export type GenerateStage = 'preparing' | 'uploading' | 'generating' | 'retrying' | 'finishing';

export type GenerateOptions = {
  uri: string;
  lookId: string;
  strength?: number;
  onStage?: (stage: GenerateStage) => void;
  signal?: AbortSignal;
  /** The app's local calendar day, so the server's daily refresh lines up with the user's midnight. */
  day?: string;
};

/** The server's photo balance after a request, when it keeps one. */
export type ServerCredits = { daily: number; pack: number };

export type GenerateResult = {
  credits?: ServerCredits;
  resultUri: string;
  /** The downscaled, orientation-normalised JPEG that was sent. */
  sourceUri: string;
  thumbUri: string;
};

export class GenerateError extends Error {
  code: string;
  credits?: ServerCredits;
  constructor(code: string, message: string, credits?: ServerCredits) {
    super(message);
    this.code = code;
    this.credits = credits;
  }
}

const FRIENDLY: Record<string, string> = {
  unauthorized: 'This version of the app needs an update before it can make photos.',
  look: 'This look is being updated. Try another one for now.',
  config: 'The studio is being set up. Try again in a few minutes.',
  body: 'Something went wrong preparing your photo. Try again.',
  image: 'This photo is too large to send. Try a smaller one.',
  update: 'Update Exposure to keep making photos.',
  credits: 'You are out of photos for now.',
  inflight: 'Your last photo is still being made. Give it a moment.',
};

export function isGenerationLive(): boolean {
  return Boolean(API_URL);
}

function isAbort(error: unknown): boolean {
  return (error as Error)?.name === 'AbortError';
}

export async function generateLook({ uri, lookId, strength, onStage, signal, day }: GenerateOptions): Promise<GenerateResult> {
  if (!API_URL) return simulate(uri, lookId, onStage, signal);

  onStage?.('preparing');
  let image;
  try {
    image = await prepareForUpload(uri);
  } catch (error) {
    if (error instanceof ImageReadError) throw new GenerateError('photo', error.message);
    throw error;
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const timeout = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const body = JSON.stringify({ lookId, image: { mimeType: image.mimeType, data: image.data, width: image.width, height: image.height }, strength });

  const userId = await getUserId();
  const identity: Record<string, string> = { ...(userId ? { 'x-exposure-user': userId } : {}), ...(day ? { 'x-exposure-day': day } : {}) };

  let payload: Payload;
  try {
    payload = await post(body, identity, combined, onStage, true);
  } catch (error) {
    if (isAbort(error) && timeout.aborted && !signal?.aborted) {
      throw new GenerateError('timeout', 'That took too long. Try again, nothing was charged.');
    }
    throw error;
  }

  onStage?.('finishing');
  const name = `exposure-${lookId}-${Date.now()}`;
  let resultUri = await persistEncoded(payload.image, name);
  // The model only outputs a few fixed ratios; trim any slack so the framing matches the photo picked.
  if (getLook(lookId)?.framing !== 'free') resultUri = await matchFraming(resultUri, image.width, image.height);
  const thumbUri = await makeThumbnail(resultUri, `${name}-thumb`);
  return { resultUri, sourceUri: image.uri, thumbUri, credits: payload.credits };
}

type Payload = { image: { mimeType: string; data: string }; credits?: ServerCredits };

async function post(
  body: string,
  identity: Record<string, string>,
  signal: AbortSignal,
  onStage: GenerateOptions['onStage'],
  allowBusyRetry: boolean
): Promise<Payload> {
  onStage?.('uploading');
  // The response only arrives once the model is done, so switch the copy to "generating" on a timer.
  const generatingTimer = setTimeout(() => onStage?.('generating'), GENERATING_AFTER_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(APP_TOKEN ? { 'x-exposure-app': APP_TOKEN } : {}), ...identity },
      body,
      signal,
    });
  } catch (error) {
    clearTimeout(generatingTimer);
    if (isAbort(error)) throw error;
    throw new GenerateError('offline', 'You look offline. Check your connection and try again.');
  }
  clearTimeout(generatingTimer);

  if (!response.ok) {
    let message = 'The look could not be made right now.';
    let code = 'upstream';
    let credits: ServerCredits | undefined;
    if (response.status === 413) {
      code = 'image';
    } else {
      try {
        const json = (await response.json()) as { error?: { code?: string; message?: string }; credits?: ServerCredits };
        const error = json.error;
        credits = json.credits;
        code = error?.code ?? code;
        message = error?.message ?? message;
      } catch {}
    }
    if (code === 'busy' && allowBusyRetry) {
      onStage?.('retrying');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, BUSY_RETRY_DELAY_MS);
        signal.addEventListener('abort', () => (clearTimeout(timer), reject(new DOMException('Aborted', 'AbortError'))), { once: true });
      });
      return post(body, identity, signal, onStage, false);
    }
    throw new GenerateError(code, FRIENDLY[code] ?? message, credits);
  }

  try {
    return (await response.json()) as Payload;
  } catch {
    throw new GenerateError('upstream', 'The look came back damaged. Try again, nothing was charged.');
  }
}

function simulate(uri: string, lookId: string, onStage?: (stage: GenerateStage) => void, signal?: AbortSignal): Promise<GenerateResult> {
  return new Promise((resolve, reject) => {
    const stages: GenerateStage[] = ['preparing', 'uploading', 'generating', 'finishing'];
    let index = 0;
    const tick = () => {
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      if (index < stages.length) {
        onStage?.(stages[index++]);
        setTimeout(tick, index === 3 ? 1800 : 500);
      } else {
        makeThumbnail(uri, `exposure-${lookId}-${Date.now()}-thumb`).then((thumbUri) => resolve({ resultUri: uri, sourceUri: uri, thumbUri }));
      }
    };
    setTimeout(tick, 0);
  });
}
