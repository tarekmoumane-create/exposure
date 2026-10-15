import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = PropsWithChildren<{
  /** Scrollable content (default) or a fixed flex container. */
  scroll?: boolean;
  /** Leave room for the tab bar. */
  withTabBar?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
}>;

export function Screen({
  children,
  scroll = true,
  withTabBar = false,
  edges = ['top', 'left', 'right'],
  contentStyle,
}: Props) {
  const theme = useTheme();
  const paddingBottom = withTabBar ? BottomTabInset + Spacing.four : Spacing.four;

  if (!scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.inner, { paddingBottom }, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.inner, { paddingBottom }, contentStyle]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    flexGrow: 1,
  },
});
