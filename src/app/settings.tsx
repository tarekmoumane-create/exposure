import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ExternalLink } from '@/components/external-link';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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
    <Screen edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ headerRight: () => <Button title="Done" variant="ghost" size="md" onPress={() => router.back()} /> }} />
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.planRow}>
          <View>
            <ThemedText type="label" themeColor="textTertiary">
              Plan
            </ThemedText>
            <ThemedText type="title">{PLAN_LABEL[plan]}</ThemedText>
          </View>
          <View style={styles.planRight}>
            <ThemedText type="label" themeColor="textTertiary">
              Frames left
            </ThemedText>
            <ThemedText type="title">{credits}</ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {plan === 'free'
            ? 'Join a plan to develop whole rolls, with new frames every day.'
            : `${allowance} new frames ${refreshLabel}. Unused ones bank for three days.${packCredits ? ` ${packCredits} extra never expire.` : ''}`}
        </ThemedText>
        {plan === 'free' ? <Button title="See plans" size="md" onPress={() => router.push('/paywall')} /> : null}
        {plan !== 'free' ? (
          <>
            <ThemedText type="caption" themeColor="textTertiary">
              {dailyCredits} from your plan today
            </ThemedText>
            <View style={styles.inlineButtons}>
              {plan === 'weekly' ? <Button title="Switch to Yearly" size="md" onPress={() => router.push('/paywall')} /> : null}
              <Button title="Manage subscription" variant="secondary" size="md" onPress={manageSubscription} />
            </View>
          </>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Row label="Your rolls" value={`${rolls.length}`} />
        <Row label="Stored" value="On this phone only" />
        <Row label="Account" value="None needed" />
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <ThemedText type="label" themeColor="textTertiary">
          Privacy
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Photos leave your phone only when you develop a roll or order prints. Developing sends them to Google Gemini
          and nothing is stored on our servers. Print orders go to our print lab, and those files are deleted within
          21 days. No ads, no tracking, no face data kept.
        </ThemedText>
        <Row label="Google Gemini processing" value={aiConsent ? 'Allowed' : 'Off'} />
        {aiConsent ? (
          <Button title="Turn off" variant="secondary" size="md" onPress={() => setAiConsent(false)} />
        ) : (
          <ThemedText type="caption" themeColor="textTertiary">
            You’ll be asked again before your next roll develops.
          </ThemedText>
        )}
        <View style={styles.links}>
          <ExternalLink href="https://exposure-api.vercel.app/privacy">
            <ThemedText type="small" style={{ color: theme.brand }}>
              Privacy policy
            </ThemedText>
          </ExternalLink>
          <ExternalLink href="https://exposure-api.vercel.app/terms">
            <ThemedText type="small" style={{ color: theme.brand }}>
              Terms of service
            </ThemedText>
          </ExternalLink>
          <ExternalLink href="mailto:tarekmoumane@gmail.com">
            <ThemedText type="small" style={{ color: theme.brand }}>
              Contact
            </ThemedText>
          </ExternalLink>
        </View>
      </View>

      <Button title="Restore purchases" variant="ghost" size="md" onPress={onRestore} loading={restoring} />
      {status ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
          {status}
        </ThemedText>
      ) : null}
      <ThemedText type="caption" themeColor="textTertiary" style={styles.version}>
        Exposure {version}
      </ThemedText>
    </Screen>
  );
}

/** "tonight at midnight" before 6pm, "at midnight" after: the refresh is always local midnight. */
function refreshCopy(): string {
  return new Date().getHours() < 18 ? 'tonight at midnight' : 'at midnight';
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText type="bodyStrong">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, marginTop: Spacing.three },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  planRight: { alignItems: 'flex-end' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  links: { gap: Spacing.two },
  inlineButtons: { gap: Spacing.two },
  version: { textAlign: 'center', paddingTop: Spacing.three },
});
