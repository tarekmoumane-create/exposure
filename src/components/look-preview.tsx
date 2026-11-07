import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth } from '@/constants/theme';
import { type Look } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';

/** A photographic canvas with its comparison control kept outside the image. */
export function LookPreview({ look, compact = false, label }: { look: Look; compact?: boolean; label?: string }) {
  const theme = useTheme();
  const [original, setOriginal] = useState(false);
  const { width } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const previewWidth = measuredWidth ?? Math.max(1, Math.min(width, MaxContentWidth) - 48);
  const imageHeight = compact ? previewWidth / 1.22 : Math.min(previewWidth * 1.1, 420);

  return (
    <View
      onLayout={({ nativeEvent }) => {
        if (nativeEvent.layout.width > 0) setMeasuredWidth(nativeEvent.layout.width);
      }}
      style={[styles.root, { height: imageHeight + 34 }]}>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={`${look.name} example. Press and hold to see the original.`}
        onPressIn={() => setOriginal(true)}
        onPressOut={() => setOriginal(false)}
        style={[styles.result, { backgroundColor: theme.surfaceRaised }]}>
        <Image source={original ? look.before : look.after} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Pressable>
      <View style={styles.caption} pointerEvents="none">
        <ThemedText type="caption">{original ? 'Original photo' : label ?? look.name}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {original ? 'Release to return' : 'Hold for original'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', flexShrink: 0 },
  result: { flex: 1, borderRadius: 2, overflow: 'hidden' },
  caption: { height: 34, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
});
