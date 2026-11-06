import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  /** Fires continuously while dragging. Keep it cheap. */
  onChange: (value: number) => void;
  /** Fires once when the finger lifts; use it to persist. */
  onComplete?: (value: number) => void;
  /** How to print the value. Defaults to a percentage of the range. */
  format?: (value: number) => string;
};

export function SliderRow({ label, value, min = 0, max = 1, onChange, onComplete, format }: Props) {
  const theme = useTheme();
  const display = format ? format(value) : `${Math.round(((value - min) / (max - min)) * 100)}%`;
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="caption" themeColor="textTertiary">
          {display}
        </ThemedText>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={0.01}
        // The web slider treats an initial value of exactly 0 as unset and jumps to the minimum.
        value={value === 0 && min < 0 ? 0.000001 : value}
        onValueChange={onChange}
        onSlidingComplete={onComplete}
        minimumTrackTintColor={theme.brand}
        maximumTrackTintColor={theme.line}
        thumbTintColor={theme.brand}
        accessibilityLabel={label}
        accessibilityValue={{ min: Math.round(min * 100), max: Math.round(max * 100), now: Math.round(value * 100), text: display }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.one },
  slider: { width: '100%', height: 36 },
});
