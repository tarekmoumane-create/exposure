/** Reading and writing image bytes on web: canvas in, data uri out. */

export type EncodedImage = { mimeType: string; data: string; width?: number; height?: number };

export type PreparedUpload = EncodedImage & { uri: string; width: number; height: number };

export class ImageReadError extends Error {}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = uri;
  });
}

function draw(img: HTMLImageElement, scale: number, quality: number): { uri: string; width: number; height: number } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { uri: canvas.toDataURL('image/jpeg', quality), width: canvas.width, height: canvas.height };
}

export async function prepareForUpload(uri: string, maxEdge = 1536, quality = 0.88): Promise<PreparedUpload> {
  try {
    const img = await loadImage(uri);
    const out = draw(img, Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight)), quality);
    return { mimeType: 'image/jpeg', data: out.uri.slice(out.uri.indexOf(',') + 1), ...out };
  } catch {
    throw new ImageReadError('This photo could not be read. Try another one.');
  }
}

export async function persistEncoded({ mimeType, data }: EncodedImage): Promise<string> {
  return `data:${mimeType};base64,${data}`;
}

export function persistToGallery(uri: string): string {
  return uri;
}

export async function makeThumbnail(uri: string, _name: string, maxEdge = 480): Promise<string> {
  try {
    const img = await loadImage(uri);
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    return scale === 1 ? uri : draw(img, scale, 0.85).uri;
  } catch {
    return uri;
  }
}

/** Centre-crops the result to the original's aspect ratio when the model returned a different shape. */
export async function matchFraming(uri: string, width: number, height: number, tolerance = 0.012): Promise<string> {
  try {
    const target = width / height;
    const img = await loadImage(uri);
    const ratio = img.naturalWidth / img.naturalHeight;
    if (Math.abs(ratio - target) / target <= tolerance) return uri;
    const cropW = ratio > target ? Math.round(img.naturalHeight * target) : img.naturalWidth;
    const cropH = ratio > target ? img.naturalHeight : Math.round(img.naturalWidth / target);
    const canvas = document.createElement('canvas');
    canvas.width = cropW;
    canvas.height = cropH;
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - cropW) / 2, (img.naturalHeight - cropH) / 2, cropW, cropH, 0, 0, cropW, cropH);
    return canvas.toDataURL('image/jpeg', 0.95);
  } catch {
    return uri;
  }
}
