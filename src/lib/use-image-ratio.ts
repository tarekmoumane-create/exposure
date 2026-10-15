import { useEffect, useState } from 'react';
import { Image } from 'react-native';

/** Width/height of an image uri, clamped so previews never get absurdly tall or wide. */
export function useImageRatio(uri: string, fallback = 0.8, min = 0.6, max = 1.5): number {
  const [ratio, setRatio] = useState(fallback);
  useEffect(() => {
    let cancelled = false;
    if (!uri) return;
    Image.getSize(
      uri,
      (width, height) => {
        if (!cancelled && width > 0 && height > 0) setRatio(Math.min(max, Math.max(min, width / height)));
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [uri, min, max]);
  return ratio;
}
