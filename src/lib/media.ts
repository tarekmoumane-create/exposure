import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import { persistToGallery } from '@/lib/image-io';

export type SaveResult = 'saved' | 'denied' | 'failed';

/** Saves a local file uri to the user's photo library. */
export async function saveToPhotos(uri: string): Promise<SaveResult> {
  try {
    const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) return 'denied';
    await MediaLibrary.Asset.create(uri);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Opens the system share sheet for a local file uri. */
export async function shareFile(uri: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Share your photo' });
    return true;
  } catch {
    return false;
  }
}

/** Copies a temporary picker/camera uri into the gallery folder so it survives the session and cache sweeps. */
export function persistTemporary(uri: string): string {
  return persistToGallery(uri, `exposure-src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
}
