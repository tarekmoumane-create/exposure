import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** The frame and sun mark beside the wordmark. */
export function Wordmark({ size = 20 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Exposure">
      <Image source={require('@/assets/images/mark.png')} style={{ width: size * 1.25, height: size * 1.25 }} contentFit="contain" tintColor={theme.brand} />
      <ThemedText type="wordmark" style={{ fontSize: size, lineHeight: size * 1.3, letterSpacing: size * 0.1 }}>
        EXPOSURE
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
});
