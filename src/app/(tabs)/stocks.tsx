import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { LOOK_GROUPS, LOOKS } from '@/data/looks';
import { useTheme } from '@/hooks/use-theme';

/** Every film, camera and light a roll can be developed in. */
export default function LooksScreen() {
  const theme = useTheme();
  return (
    <Screen withTabBar>
      <View style={styles.header}>
        <ThemedText type="display" accessibilityRole="header">
          Looks
        </ThemedText>
        <ThemedText themeColor="textSecondary">Each roll is developed in one look. Choose by where your photos were taken.</ThemedText>
      </View>
      {LOOK_GROUPS.map((group) => (
        <View key={group.id} style={styles.group}>
          <ThemedText type="subtitle">{group.label}</ThemedText>
          {LOOKS.filter((look) => look.group === group.id).map((look) => (
            <Pressable
              key={look.id}
              accessibilityRole="button"
              accessibilityLabel={`${look.name}. ${look.tagline}`}
              onPress={() => router.push({ pathname: '/stock/[id]', params: { id: look.id } })}
              style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, borderColor: theme.line, opacity: pressed ? 0.7 : 1 }]}>
              <Image source={look.after} style={[styles.photo, { backgroundColor: theme.surfaceRaised }]} contentFit="cover" />
              <View style={styles.text}>
                <ThemedText type="bodyStrong">{look.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {look.tagline}
                </ThemedText>
                <ThemedText type="caption" themeColor="textTertiary">
                  {look.bestFor}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, paddingTop: Spacing.three, paddingBottom: Spacing.three },
  group: { paddingTop: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, marginTop: Spacing.two },
  photo: { width: 76, height: 95, borderRadius: Radius.print },
  text: { flex: 1, gap: 2, justifyContent: 'center' },
});
