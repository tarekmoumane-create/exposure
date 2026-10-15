import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Italic serif wordmark with a rose accent. */
export function Wordmark({ size = 26 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Exposure">
      <ThemedText type="wordmark" style={{ fontSize: size, lineHeight: size * 1.25 }}>
        exposure
      </ThemedText>
      <View
        style={{
          width: size * 0.22,
          height: size * 0.22,
          borderRadius: size,
          backgroundColor: theme.accent,
          marginLeft: size * 0.1,
          marginTop: size * 0.45,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
});
