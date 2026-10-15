import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_600SemiBold_Italic,
} from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';

/** Loads the two brand typefaces. Returns true once they are ready (or failed, so the app never hangs). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_600SemiBold_Italic,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  return loaded || !!error;
}
