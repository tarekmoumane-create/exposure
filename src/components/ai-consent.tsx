import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ExternalLink } from '@/components/external-link';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
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
        <View style={[styles.thumb, { backgroundColor: theme.surfaceRaised }]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
        <View style={styles.copy}>
          <ThemedText type="title" accessibilityRole="header">Ready to develop?</ThemedText>
          <ThemedText themeColor="textSecondary">One quick permission before we create your new camera look.</ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <View style={[styles.disclosure, { borderColor: theme.line }]}>
          <ThemedText type="small" themeColor="textSecondary">
            With your permission, Exposure sends the photos you select to Google Gemini, Google’s AI service, to develop your roll.
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.detail}>
            Exposure doesn’t keep these photos on its servers after processing. Google may retain them temporarily for abuse prevention.
          </ThemedText>
          <ExternalLink href={LEGAL_URLS.privacy}>
            <ThemedText type="caption" themeColor="brand" style={styles.link}>Privacy policy</ThemedText>
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
  screen: { paddingHorizontal: 24 },
  body: { gap: Spacing.four, paddingTop: Spacing.four, paddingBottom: Spacing.four },
  thumb: { width: 104, height: 130, borderRadius: Radius.md, overflow: 'hidden' },
  copy: { gap: Spacing.two },
  disclosure: { gap: 10, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth },
  detail: { lineHeight: 19 },
  link: { textDecorationLine: 'underline', paddingVertical: 8 },
  actions: { marginTop: 'auto', gap: Spacing.two, paddingBottom: Spacing.two },
  center: { textAlign: 'center', fontSize: 12, lineHeight: 18 },
});
