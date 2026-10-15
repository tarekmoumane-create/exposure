import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected = false, disabled = false, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.text : theme.surface,
          borderColor: selected ? theme.text : theme.line,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}>
      <ThemedText type="caption" style={{ color: selected ? theme.surface : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
