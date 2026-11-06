import { useFont } from '@shopify/react-native-skia';

/** The typeface printed on contact sheets. */
export function useSheetFont() {
  return useFont(require('@/assets/fonts/BricolageGrotesque_700Bold.ttf'), 40);
}
