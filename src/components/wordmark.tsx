import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** The frame and sun mark beside the wordmark. */
export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Exposure">
      <Image source={require('@/assets/images/mark.png')} style={{ width: size * 1.25, height: size * 1.25 }} contentFit="contain" />
      <ThemedText type="wordmark" style={{ fontSize: size, lineHeight: size * 1.2 }}>
        exposure
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
