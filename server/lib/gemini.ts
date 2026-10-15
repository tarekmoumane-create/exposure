/**
 * Thin client for the Gemini image models ("Nano Banana"). One call: photo in, photo out.
 * Nothing is stored; the request body is held in memory only for the duration of the call.
 *
 * The prompt is passed verbatim; relight.ts builds it.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export type ImageSize = '1K' | '2K' | '4K';
export type ThinkingLevel = 'minimal' | 'medium' | 'high';

export type GenerateInput = {
  apiKey: string;
  model: string;
  /** Tried in order when the primary model is overloaded (503) or rate limited (429). */
  fallbackModels?: string[];
  image: { mimeType: string; data: string };
  /** Extra images appended after the photo (style references). */
  references?: { mimeType: string; data: string }[];
  prompt: string;
  imageSize?: ImageSize;
  thinkingLevel?: ThinkingLevel;
  /** One of the model's supported ratios, chosen to be nearest the input so it does not outpaint. */
  aspectRatio?: string;
  /** Drop the framing lock (and the ratio hint) for looks that change the format, like the booth strip. */
  freeFraming?: boolean;
  /** Absolute time (ms) by which a result must be back; the fallback is skipped when it cannot fit. */
  deadline?: number;
};

export type GenerateOutput = { mimeType: string; data: string; model: string };

type GeminiError = Error & { status?: number };

function fail(message: string, status: number): GeminiError {
  const error = new Error(message) as GeminiError;
  error.status = status;
  return error;
}

/** The legacy model ignores imageConfig / thinkingConfig; everything newer accepts them. */
function supportsImageConfig(model: string): boolean {
  return !model.startsWith('gemini-2.5-flash-image');
}

async function callModel(
  model: string,
  { apiKey, image, references, prompt, imageSize, thinkingLevel, aspectRatio, freeFraming, deadline }: GenerateInput
): Promise<GenerateOutput> {
  const generationConfig: Record<string, unknown> = { responseModalities: ['IMAGE'] };
  if (supportsImageConfig(model)) {
    const imageConfig: Record<string, string> = {};
    if (imageSize) imageConfig.imageSize = imageSize;
    if (aspectRatio && !freeFraming) imageConfig.aspectRatio = aspectRatio;
    if (Object.keys(imageConfig).length) generationConfig.imageConfig = imageConfig;
    if (thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel };
  }

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: image.mimeType, data: image.data } },
          ...(references ?? []).map((ref) => ({ inlineData: { mimeType: ref.mimeType, data: ref.data } })),
        ],
      },
    ],
    generationConfig,
  };

  const budget = deadline ? Math.max(5_000, deadline - Date.now()) : CALL_TIMEOUT_MS;
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Math.min(CALL_TIMEOUT_MS, budget)),
    });
  } catch (error) {
    throw fail(`Gemini timeout (${model}): ${(error as Error).message}`, 504);
  }

  if (!response.ok) {
    const text = await response.text();
    throw fail(`Gemini ${response.status} (${model}): ${text.slice(0, 300)}`, response.status);
  }

  const json = (await response.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string }; text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) throw fail(`blocked: ${json.promptFeedback.blockReason}`, 422);

  // Thinking models may return interim images; the last inline image is the final one.
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const images = parts.filter((part) => part.inlineData);
  const imagePart = images[images.length - 1];
  if (!imagePart?.inlineData) {
    const reason = json.candidates?.[0]?.finishReason ?? 'no-image';
    throw fail(`no image returned (${reason})`, 422);
  }
  return { ...imagePart.inlineData, model };
}

function isCapacityError(error: unknown): boolean {
  const status = (error as GeminiError).status;
  // 500/502 from the API front end are transient (an HTML error page), the same as overload.
  return status === 503 || status === 502 || status === 500 || status === 429;
}

// Capacity errors come back in under a second, and a real render takes ~30 s inside a 60 s function budget,
// so retry once quickly and then move to the fallback model instead of waiting.
const RETRY_DELAYS_MS = [1000];
/** A single model call never runs longer than this; a render usually takes 15–35 s. */
const CALL_TIMEOUT_MS = 50_000;
/** A fallback attempt is only worth starting with this much of the deadline left. */
const MIN_FALLBACK_BUDGET_MS = 30_000;

/**
 * Generates with the primary model, retrying briefly on capacity errors, then walking the
 * fallback list. Anything else (blocked, bad input) surfaces immediately.
 */
export async function generateImage(input: GenerateInput): Promise<GenerateOutput> {
  const models = [input.model, ...(input.fallbackModels ?? [])];
  let lastError: unknown;
  for (const [index, model] of models.entries()) {
    if (index > 0 && input.deadline && input.deadline - Date.now() < MIN_FALLBACK_BUDGET_MS) break;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await callModel(model, input);
      } catch (error) {
        lastError = error;
        if (!isCapacityError(error)) throw error;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/** Output ratios the image models accept. */
const SUPPORTED_RATIOS: [string, number][] = [
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['5:4', 5 / 4],
  ['3:4', 3 / 4],
  ['4:3', 4 / 3],
  ['2:3', 2 / 3],
  ['3:2', 3 / 2],
  ['9:16', 9 / 16],
  ['16:9', 16 / 9],
  ['21:9', 21 / 9],
];

/** The supported ratio closest to width/height, so the model has no reason to extend the frame. */
export function nearestAspectRatio(width: number, height: number): string | undefined {
  if (!(width > 0 && height > 0)) return undefined;
  const target = Math.log(width / height);
  let best: [string, number] | undefined;
  for (const entry of SUPPORTED_RATIOS) {
    const distance = Math.abs(Math.log(entry[1]) - target);
    if (!best || distance < best[1]) best = [entry[0], distance];
  }
  return best?.[0];
}
