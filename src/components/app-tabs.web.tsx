import { Tabs } from 'expo-router';
import { type ColorValue, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, MaxContentWidth } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

const palette = Colors.light;

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <ThemedText style={[styles.glyph, { color }]}>{glyph}</ThemedText>;
}

/** Web fallback: the standard JS tab navigator. Native platforms use app-tabs.tsx. */
export default function AppTabs() {
  const { printConfig, orders, paid } = useAppStore();
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: palette.background },
        tabBarActiveTintColor: palette.text,
        tabBarInactiveTintColor: palette.textTertiary,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Rolls', tabBarIcon: ({ color }) => <TabIcon glyph="▤" color={color} /> }} />
      <Tabs.Screen name="stocks" options={{ title: 'Looks', href: paid ? undefined : null, tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} /> }} />
      <Tabs.Screen name="prints" options={{ title: 'Prints', href: printConfig.enabled || orders.length > 0 ? undefined : null, tabBarIcon: ({ color }) => <TabIcon glyph="✉" color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: palette.background, borderTopColor: palette.line, height: 64, paddingTop: 6 },
  label: { fontFamily: Fonts.sansSemi, fontSize: 11 },
  item: { maxWidth: MaxContentWidth / 3 },
  glyph: { fontSize: 20, lineHeight: 24 },
});
