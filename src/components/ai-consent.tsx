import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ExternalLink } from '@/components/external-link';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Radius, Spacing } from '@/constants/theme';
import { LEGAL_URLS } from '@/data/products';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** The first photo about to be sent, so the user sees what is shared. */
  uri: string;
  onAgree: () => void;
  onDecline: () => void;
};

/** Explicit permission before processing, with a neutral title and a readable inline disclosure. */
export function AiConsent({ uri, onAgree, onDecline }: Props) {
  const theme = useTheme();
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} contentStyle={styles.screen}>
      <View style={styles.body}>
        <View style={styles.figure}>
          <View style={[styles.thumb, { backgroundColor: theme.surfaceRaised }]}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
          <ThemedText type="monoSmall" themeColor="textTertiary">Fr 01 · ready</ThemedText>
        </View>
        <View style={styles.copy}>
          <ThemedText type="display" accessibilityRole="header">Ready to develop?</ThemedText>
          <ThemedText themeColor="textSecondary">One quick permission before your photo goes into the developer.</ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <View style={[styles.disclosure, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <ThemedText type="mono" themeColor="textTertiary">How it works</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            With your permission, Exposure sends the photos you select to Google Gemini, Google’s AI service, to develop your roll.
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.detail}>
            Exposure doesn’t keep these photos on its servers after processing. Google may retain them temporarily for abuse prevention.
          </ThemedText>
          <ExternalLink href={LEGAL_URLS.privacy}>
            <ThemedText type="caption" style={styles.link}>Privacy policy</ThemedText>
          </ExternalLink>
        </View>
        <Button title="Allow and develop" onPress={onAgree} />
        <Button title="Not now" variant="ghost" size="md" onPress={onDecline} />
        <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
          You can turn this off any time in Settings.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: Gutter },
  body: { gap: Spacing.four, paddingTop: Spacing.five, paddingBottom: Spacing.four },
  figure: { gap: 6, alignSelf: 'flex-start' },
  thumb: { width: 112, height: 140, borderRadius: Radius.print, overflow: 'hidden' },
  copy: { gap: 10 },
  disclosure: { gap: 10, padding: 18, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, marginBottom: 8 },
  detail: { lineHeight: 19 },
  link: { textDecorationLine: 'underline', paddingTop: 4 },
  actions: { marginTop: 'auto', gap: Spacing.two, paddingBottom: Spacing.two },
  center: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
