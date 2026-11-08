import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Print } from '@/components/print';
import { ExternalLink } from '@/components/external-link';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Gutter, Spacing } from '@/constants/theme';
import { LEGAL_URLS } from '@/data/products';

type Props = {
  /** The first photo about to be sent, so the user sees what is shared. */
  uri: string;
  onAgree: () => void;
  onDecline: () => void;
};

/** Explicit permission before processing, with a neutral title and a readable inline disclosure. */
export function AiConsent({ uri, onAgree, onDecline }: Props) {
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']} glow contentStyle={styles.screen}>
      <View style={styles.body}>
        <View style={styles.figure}>
          <Print source={{ uri }} rotate={-4} border={6} style={styles.thumb} />
        </View>
        <View style={styles.copy}>
          <ThemedText type="display" accessibilityRole="header">Ready to develop?</ThemedText>
          <ThemedText themeColor="textSecondary">One quick permission before your photo goes into the developer.</ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Allow and develop" onPress={onAgree} />
        <Button title="Not now" variant="ghost" size="md" onPress={onDecline} />
        <ThemedText type="caption" themeColor="textTertiary" style={styles.fine}>
          {'Allow sends the photos you choose to Google Gemini, Google’s AI, to develop them. Exposure doesn’t keep them. Turn this off any time in Settings. '}
          <ExternalLink href={LEGAL_URLS.privacy}>
            <ThemedText type="caption" themeColor="textTertiary" style={[styles.fine, styles.link]}>Privacy policy</ThemedText>
          </ExternalLink>
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: Gutter },
  body: { gap: Spacing.four, paddingTop: Spacing.five, paddingBottom: Spacing.four },
  figure: { alignSelf: 'flex-start', paddingLeft: 6 },
  thumb: { width: 132 },
  copy: { gap: 10 },
  actions: { marginTop: 'auto', gap: Spacing.one, paddingBottom: Spacing.two },
  fine: { textAlign: 'center', fontSize: 11, lineHeight: 15, paddingHorizontal: 8 },
  link: { textDecorationLine: 'underline' },
});
