import { Image } from 'expo-image';

/**
 * The mark: the app icon itself (a frame of film filling with light) as a small
 * rounded tile, so the logo in the app is the one on the home screen.
 */
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/mark.png')}
      style={{ width: size, height: size, borderRadius: size * 0.225 }}
      contentFit="cover"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
