import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold } from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';

/** Loads the brand typefaces. Returns true once they are ready (or failed, so the app never hangs). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    DMMono_400Regular,
    DMMono_500Medium,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  return loaded || !!error;
}
