import { type PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Glow } from '@/components/glow';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = PropsWithChildren<{
  /** Scrollable content (default) or a fixed flex container. */
  scroll?: boolean;
  /** Leave room for the tab bar. */
  withTabBar?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  /** Warm light from the top of the screen: true for the house glow, or a look's tint. */
  glow?: boolean | string;
}>;

export function Screen({
  children,
  scroll = true,
  withTabBar = false,
  edges = ['top', 'left', 'right'],
  contentStyle,
  glow,
}: Props) {
  const theme = useTheme();
  const light = glow ? <Glow tint={typeof glow === 'string' ? glow : undefined} /> : null;
  const paddingBottom = withTabBar ? BottomTabInset + Spacing.four : Spacing.four;

  if (!scroll) {
    return (
      <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: theme.background }]}>
        {light}
        <View style={[styles.inner, styles.fixed, { paddingBottom }, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: theme.background }]}>
      {light}
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
  // A fixed screen is exactly the height it is given, never its content's: a long list scrolls inside it.
  fixed: { flex: 1, minHeight: 0 },
});
