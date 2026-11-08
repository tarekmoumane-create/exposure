import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A soft filter pill. Selected is filled with ink. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? theme.text : theme.surfaceRaised, opacity: pressed ? 0.75 : 1 },
      ]}>
      <ThemedText type="caption" style={{ color: selected ? theme.onBrand : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { height: 36, paddingHorizontal: 16, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
