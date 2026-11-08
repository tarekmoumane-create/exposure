import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/logo-mark';
import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';

/** The mark beside the name. */
export function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Exposure">
      <LogoMark size={size * 1.3} />
      <ThemedText style={[styles.name, { fontSize: size, lineHeight: size * 1.25, letterSpacing: size * 0.16 }]}>EXPOSURE</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  name: { fontFamily: Fonts.sansSemi },
});
