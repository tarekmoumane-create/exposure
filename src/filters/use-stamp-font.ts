import { useFont } from '@shopify/react-native-skia';

/** Font used for the date stamp when rendering strips on native. */
export function useStampFont() {
  return useFont(require('@/assets/fonts/Manrope_600SemiBold.ttf'), 30);
}
