import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  name: SymbolViewProps['name'];
  label: string;
  onPress: () => void;
};

/** Round, light icon button, like the settings gear in the header. */
export function IconButton({ name, label, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.surfaceRaised, opacity: pressed ? 0.7 : 1 }]}>
      <SymbolView name={name} size={18} tintColor={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
