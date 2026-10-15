/**
 * The generation call. Prepares the photo, posts it to the Exposure API, and returns local uris
 * for the result and the normalised source. With no API URL configured (web preview, early dev)
 * it runs a simulated pass so the rest of the flow is still exercisable.
 */

import { getLook } from '@/data/looks';
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
};

export type GenerateResult = {
  resultUri: string;
  /** The downscaled, orientation-normalised JPEG that was sent. */
  sourceUri: string;
  thumbUri: string;
};

export class GenerateError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const FRIENDLY: Record<string, string> = {
  unauthorized: 'This version of the app needs an update before it can make photos.',
  look: 'This look is being updated. Try another one for now.',
  config: 'The studio is being set up. Try again in a few minutes.',
  body: 'Something went wrong preparing your photo. Try again.',
  image: 'This photo is too large to send. Try a smaller one.',
};

export function isGenerationLive(): boolean {
  return Boolean(API_URL);
}

function isAbort(error: unknown): boolean {
  return (error as Error)?.name === 'AbortError';
}

export async function generateLook({ uri, lookId, strength, onStage, signal }: GenerateOptions): Promise<GenerateResult> {
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

  let payload: { image: { mimeType: string; data: string } };
  try {
    payload = await post(body, combined, onStage, true);
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
  return { resultUri, sourceUri: image.uri, thumbUri };
}

async function post(
  body: string,
  signal: AbortSignal,
  onStage: GenerateOptions['onStage'],
  allowBusyRetry: boolean
): Promise<{ image: { mimeType: string; data: string } }> {
  onStage?.('uploading');
  // The response only arrives once the model is done, so switch the copy to "generating" on a timer.
  const generatingTimer = setTimeout(() => onStage?.('generating'), GENERATING_AFTER_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(APP_TOKEN ? { 'x-exposure-app': APP_TOKEN } : {}) },
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
    if (response.status === 413) {
      code = 'image';
    } else {
      try {
        const error = ((await response.json()) as { error?: { code?: string; message?: string } }).error;
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
      return post(body, signal, onStage, false);
    }
    throw new GenerateError(code, FRIENDLY[code] ?? message);
  }

  try {
    return (await response.json()) as { image: { mimeType: string; data: string } };
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
