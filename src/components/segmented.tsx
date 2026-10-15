import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props<T extends string> = {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: theme.surfaceRaised }]}>
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.selectionAsync();
              onChange(option.id);
            }}
            style={[styles.item, active && { backgroundColor: theme.surface }, active && styles.itemActive]}>
            <ThemedText type="caption" style={{ color: active ? theme.text : theme.textTertiary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 3, borderRadius: Radius.pill },
  item: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.pill },
  itemActive: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
});
