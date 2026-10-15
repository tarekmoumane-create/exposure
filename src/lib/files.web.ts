/** Web keeps data URIs in memory and storage; nothing to relocate or delete. */

export function toMediaKey(uri: string): string {
  return uri;
}

export function fromMediaKey(key: string): string {
  return key;
}

export function deleteMedia(_keyOrUri: string): void {}
