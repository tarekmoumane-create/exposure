import * as Haptics from 'expo-haptics';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { FilteredImage, type FilteredImageSource } from '@/filters/filtered-image';
import { DEFAULT_CONFIG, PRESETS } from '@/filters/presets';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** The photo used for the thumbnails. */
  source: FilteredImageSource;
  value: string;
  onChange: (presetId: string) => void;
};

const THUMB_W = 64;
const THUMB_H = 80;

/** Horizontal row of filter thumbnails, each rendered live on the user's own photo. */
export function PresetStrip({ source, value, onChange }: Props) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {PRESETS.map((preset) => {
        const active = preset.id === value;
        return (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={preset.name}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              onChange(preset.id);
            }}
            style={styles.item}>
            <View style={[styles.thumb, { borderColor: active ? theme.text : 'transparent' }]}>
              <FilteredImage source={source} config={{ ...DEFAULT_CONFIG, preset: preset.id }} width={THUMB_W} height={THUMB_H} style={styles.thumbImage} />
            </View>
            <ThemedText type="caption" style={{ color: active ? theme.text : theme.textTertiary }}>
              {preset.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two, paddingHorizontal: Spacing.three },
  item: { alignItems: 'center', gap: 6 },
  thumb: { borderWidth: 2, borderRadius: Radius.md, padding: 2 },
  thumbImage: { borderRadius: Radius.md - 3 },
});
