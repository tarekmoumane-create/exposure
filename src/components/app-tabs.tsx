import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, MaxContentWidth, TabBarHeight } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

const palette = Colors.light;

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

type TabSpec = {
  name: string;
  title: string;
  icon: { idle: SymbolViewProps['name']; active: SymbolViewProps['name'] };
  glyph: string;
};

const TABS: TabSpec[] = [
  {
    name: 'index',
    title: 'Rolls',
    icon: { idle: { ios: 'square.stack', android: 'photo_library', web: 'photo_library' }, active: { ios: 'square.stack.fill', android: 'photo_library', web: 'photo_library' } },
    glyph: '▤',
  },
  {
    name: 'stocks',
    title: 'Looks',
    icon: { idle: { ios: 'camera.aperture', android: 'camera', web: 'camera' }, active: { ios: 'camera.aperture', android: 'camera', web: 'camera' } },
    glyph: '◉',
  },
  {
    name: 'prints',
    title: 'Prints',
    icon: { idle: { ios: 'envelope', android: 'mail', web: 'mail' }, active: { ios: 'envelope.fill', android: 'mail', web: 'mail' } },
    glyph: '✉',
  },
];

/** The tabs the user can see right now: Looks only once paid, Prints only once prints exist. */
function useVisibleTabs() {
  const { printConfig, orders, paid } = useAppStore();
  return {
    stocks: paid,
    prints: printConfig.enabled || orders.length > 0,
  } as Record<string, boolean>;
}

/** A white shelf along the bottom with a hairline on top, so the tabs always sit on something. */
function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const visible = useVisibleTabs();
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 0 : 10);

  return (
    <View style={[styles.bar, { paddingBottom: bottom, backgroundColor: palette.surface, borderTopColor: palette.line }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const spec = TABS.find((tab) => tab.name === route.name);
          if (!spec || visible[route.name] === false) return null;
          const focused = state.index === index;
          const color = focused ? palette.brand : palette.textTertiary;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={spec.title}
              onPress={onPress}
              style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={styles.icon}>
                <SymbolView
                  name={focused ? spec.icon.active : spec.icon.idle}
                  size={24}
                  weight={focused ? 'semibold' : 'regular'}
                  tintColor={color}
                  fallback={<ThemedText style={[styles.glyph, { color }]}>{spec.glyph}</ThemedText>}
                />
              </View>
              <ThemedText style={[styles.label, { color, fontFamily: focused ? Fonts.sansBold : Fonts.sansSemi }]}>{spec.title}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function AppTabs() {
  const visible = useVisibleTabs();
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: palette.background } }}>
      <Tabs.Screen name="index" options={{ title: 'Rolls' }} />
      <Tabs.Screen name="stocks" options={{ title: 'Looks', href: visible.stocks ? undefined : null }} />
      <Tabs.Screen name="prints" options={{ title: 'Prints', href: visible.prints ? undefined : null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px -8px 24px rgba(120,60,90,0.06)',
  },
  row: { flexDirection: 'row', height: TabBarHeight, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 6 },
  icon: { height: 26, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 20, lineHeight: 24 },
  label: { fontSize: 11, lineHeight: 14 },
});
