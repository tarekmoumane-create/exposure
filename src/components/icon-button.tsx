import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  name: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
  /** A soft round chip behind the glyph, for headers that sit over content. */
  filled?: boolean;
};

/** A 44pt round icon button. */
export function IconButton({ name, label, onPress, filled = false }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, filled && { backgroundColor: theme.surface, borderColor: theme.line, borderWidth: StyleSheet.hairlineWidth * 2 }, { opacity: pressed ? 0.6 : 1 }]}>
      <SymbolView name={name} size={17} weight="medium" tintColor={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', margin: 2 },
});
