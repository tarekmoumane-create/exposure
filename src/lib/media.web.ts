export type SaveResult = 'saved' | 'denied' | 'failed';

/** On web, "saving" downloads the image. */
export async function saveToPhotos(uri: string): Promise<SaveResult> {
  try {
    const a = document.createElement('a');
    a.href = uri;
    a.download = `exposure-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'saved';
  } catch {
    return 'failed';
  }
}

export async function shareFile(uri: string): Promise<boolean> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const file = new window.File([blob], 'exposure.jpg', { type: 'image/jpeg' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return true;
    }
    return (await saveToPhotos(uri)) === 'saved';
  } catch {
    return false;
  }
}

export function persistTemporary(uri: string): string {
  return uri;
}
