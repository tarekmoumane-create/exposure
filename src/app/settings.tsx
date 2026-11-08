import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ExternalLink } from '@/components/external-link';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DAILY_ALLOWANCE, useAppStore } from '@/store/app-store';

const PLAN_LABEL = { free: 'Free', weekly: 'Weekly', yearly: 'Yearly' } as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const { plan, credits, dailyCredits, packCredits, rolls, restore, aiConsent, setAiConsent } = useAppStore();
  const [restoring, setRestoring] = useState(false);
  // Toasts render under native modals on iOS, so status is shown inline here.
  const [status, setStatus] = useState<string | null>(null);

  const onRestore = async () => {
    setRestoring(true);
    const result = await restore();
    setRestoring(false);
    setStatus(result.message);
  };
  const version = `${Constants.expoConfig?.version ?? '0.0.0'} (${Application.nativeBuildVersion ?? 'web'})`;
  const allowance = DAILY_ALLOWANCE[plan];
  const refreshLabel = refreshCopy();
  const manageSubscription = () =>
    Linking.openURL(Platform.OS === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions');

  return (
    <Screen edges={['bottom', 'left', 'right']} contentStyle={styles.content}>
      <Stack.Screen options={{ headerRight: () => <Button title="Done" variant="ghost" size="md" onPress={() => router.back()} /> }} />
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
        <View style={styles.planRow}>
          <View style={styles.stat}>
            <ThemedText type="mono" themeColor="textTertiary">Plan</ThemedText>
            <ThemedText type="title">{PLAN_LABEL[plan]}</ThemedText>
          </View>
          <View style={[styles.stat, styles.statRight]}>
            <ThemedText type="mono" themeColor="textTertiary">Frames left</ThemedText>
            <ThemedText type="title" style={styles.tabular}>{String(credits).padStart(2, '0')}</ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {plan === 'free'
            ? 'Join a plan to develop whole rolls, with new frames every day.'
            : `${allowance} new frames ${refreshLabel}. Unused ones bank for three days.${packCredits ? ` ${packCredits} extra never expire.` : ''} ${dailyCredits} left from your plan today.`}
        </ThemedText>
        {plan === 'free' ? <Button title="See plans" size="md" onPress={() => router.push('/paywall')} /> : null}
        {plan !== 'free' ? (
          <View style={styles.inlineButtons}>
            {plan === 'weekly' ? <Button title="Switch to Yearly" size="md" onPress={() => router.push('/paywall')} /> : null}
            <Button title="Manage subscription" variant="secondary" size="md" onPress={manageSubscription} />
          </View>
        ) : null}
      </View>

      <Section title="This phone">
        <Row label="Your rolls" value={String(rolls.length)} />
        <Row label="Stored" value="On this phone only" />
        <Row label="Account" value="None needed" last />
      </Section>

      <Section title="Privacy">
        <ThemedText type="small" themeColor="textSecondary" style={styles.para}>
          Photos leave your phone only when you develop a roll or order prints. Developing sends them to Google Gemini and nothing is stored on our servers. Print orders go to our print lab, and
          those files are deleted within 21 days. No ads, no tracking, no face data kept.
        </ThemedText>
        <Row label="Google Gemini processing" value={aiConsent ? 'Allowed' : 'Off'} last={!aiConsent} />
        {aiConsent ? (
          <View style={styles.inset}>
            <Button title="Turn off" variant="secondary" size="md" onPress={() => setAiConsent(false)} />
          </View>
        ) : (
          <ThemedText type="caption" themeColor="textTertiary" style={styles.para}>
            You’ll be asked again before your next roll develops.
          </ThemedText>
        )}
      </Section>

      <Section title="About">
        <LinkRow label="Privacy policy" href="https://exposure-api.vercel.app/privacy" />
        <LinkRow label="Terms of service" href="https://exposure-api.vercel.app/terms" />
        <LinkRow label="Contact" href="mailto:tarekmoumane@gmail.com" last />
      </Section>

      <Button title="Restore purchases" variant="ghost" size="md" onPress={onRestore} loading={restoring} style={styles.restore} />
      {status ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
          {status}
        </ThemedText>
      ) : null}
      <ThemedText type="mono" themeColor="textTertiary" style={styles.version}>
        {`Exposure ${version}`}
      </ThemedText>
    </Screen>
  );
}

/** "tonight at midnight" before 6pm, "at midnight" after: the refresh is always local midnight. */
function refreshCopy(): string {
  return new Date().getHours() < 18 ? 'tonight at midnight' : 'at midnight';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="mono" themeColor="textTertiary" style={styles.sectionTitle}>{title}</ThemedText>
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.line }]}>{children}</View>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth * 2 }]}>
      <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="label">{value}</ThemedText>
    </View>
  );
}

function LinkRow({ label, href, last }: { label: string; href: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <ExternalLink href={href as never} asChild>
      <Pressable accessibilityRole="link" style={({ pressed }) => [styles.row, !last && { borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth * 2 }, { opacity: pressed ? 0.6 : 1 }]}>
        <ThemedText type="small">{label}</ThemedText>
        <ThemedText type="small" themeColor="textTertiary">↗</ThemedText>
      </Pressable>
    </ExternalLink>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter },
  card: { gap: 14, padding: 18, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, marginTop: Spacing.three },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  stat: { gap: 4 },
  statRight: { alignItems: 'flex-end' },
  tabular: { fontVariant: ['tabular-nums'] },
  inlineButtons: { gap: Spacing.two },
  section: { gap: 8, marginTop: 26 },
  sectionTitle: { paddingHorizontal: 4 },
  group: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 16 },
  para: { paddingHorizontal: 16, paddingVertical: 14 },
  inset: { padding: 12 },
  restore: { marginTop: 18 },
  version: { textAlign: 'center', paddingTop: Spacing.two },
});
