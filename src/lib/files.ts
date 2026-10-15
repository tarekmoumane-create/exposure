/**
 * Where the gallery's files live and how they are referenced.
 *
 * Everything the gallery points at is kept in the app's document directory (never the cache, which
 * the OS purges) and stored in state as a *relative* key, because iOS changes the app container
 * path on every update, which would turn absolute file URIs into broken images.
 */

import { Directory, File, Paths } from 'expo-file-system';

const KEY_PREFIX = 'doc:';
const MEDIA_DIR = 'media';

function mediaDirectory(): Directory {
  const dir = new Directory(Paths.document, MEDIA_DIR);
  try {
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {}
  return dir;
}

/** A fresh file in the media directory. */
export function newMediaFile(name: string, ext = 'jpg'): File {
  return new File(mediaDirectory(), `${name}.${ext}`);
}

/** Turns an absolute uri inside the document directory into a stable relative key. */
export function toMediaKey(uri: string): string {
  const root = Paths.document.uri.replace(/\/$/, '');
  if (uri.startsWith(root + '/')) return KEY_PREFIX + uri.slice(root.length + 1);
  return uri;
}

/** Resolves a stored key (or a plain uri) back to something the image components can load. */
export function fromMediaKey(key: string): string {
  if (!key.startsWith(KEY_PREFIX)) return key;
  return `${Paths.document.uri.replace(/\/$/, '')}/${key.slice(KEY_PREFIX.length)}`;
}

/** Deletes a stored media file; silently ignores anything that is not ours. */
export function deleteMedia(keyOrUri: string): void {
  try {
    const uri = fromMediaKey(keyOrUri);
    const root = Paths.document.uri.replace(/\/$/, '');
    if (!uri.startsWith(root + '/')) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {}
}
