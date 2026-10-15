import { Tabs } from 'expo-router';
import { type ColorValue, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, MaxContentWidth } from '@/constants/theme';

const palette = Colors.light;

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <ThemedText style={[styles.glyph, { color }]}>{glyph}</ThemedText>;
}

/** Web fallback: the standard JS tab navigator. Native platforms use app-tabs.tsx. */
export default function AppTabs() {
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
      <Tabs.Screen name="studio" options={{ title: 'Studio', tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} /> }} />
      <Tabs.Screen name="index" options={{ title: 'Looks', tabBarIcon: ({ color }) => <TabIcon glyph="✦" color={color} /> }} />
      <Tabs.Screen name="library" options={{ title: 'Gallery', tabBarIcon: ({ color }) => <TabIcon glyph="▣" color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: palette.background, borderTopColor: palette.line, height: 64, paddingTop: 6 },
  label: { fontFamily: Fonts.sansSemi, fontSize: 11 },
  item: { maxWidth: MaxContentWidth / 3 },
  glyph: { fontSize: 20, lineHeight: 24 },
});
