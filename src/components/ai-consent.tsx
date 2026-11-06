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

const POINTS = [
  'Sent only when you develop a roll, and only the photos in it.',
  'Not stored on Exposure’s servers after your frame comes back.',
  'Never sold, and not shared with anyone besides Google for this.',
];

/**
 * Asked once, before the first photo leaves the device. Apple requires apps to say which
 * third-party AI receives personal data and to get explicit permission first (guideline 5.1.2(i)).
 */
export function AiConsent({ uri, onAgree, onDecline }: Props) {
  const theme = useTheme();
  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.body}>
        <View style={[styles.thumb, { backgroundColor: theme.surfaceRaised }]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>

        <View style={styles.copy}>
          <ThemedText type="title">Your photos go to Google’s AI</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            To develop a roll, Exposure sends your photos to Google Gemini, an AI service run by Google LLC. Google uses them
            to make your developed frames and may keep them for a short time to prevent abuse, under its own terms.
          </ThemedText>
        </View>

        <View style={[styles.points, { borderColor: theme.line }]}>
          {POINTS.map((point) => (
            <View key={point} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: theme.brand }]} />
              <ThemedText type="small" style={styles.pointText}>
                {point}
              </ThemedText>
            </View>
          ))}
        </View>

        <ExternalLink href={LEGAL_URLS.privacy}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
            Read the privacy policy
          </ThemedText>
        </ExternalLink>
      </View>

      <View style={styles.actions}>
        <Button title="Agree and continue" onPress={onAgree} />
        <Button title="Not now" variant="ghost" size="md" onPress={onDecline} />
        <ThemedText type="caption" themeColor="textTertiary" style={styles.center}>
          You can turn this off any time in Settings.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: Spacing.four, paddingTop: Spacing.four },
  thumb: { width: 72, height: 90, borderRadius: Radius.md, overflow: 'hidden' },
  copy: { gap: Spacing.two },
  points: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.three },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  pointText: { flex: 1 },
  link: { textDecorationLine: 'underline' },
  actions: { gap: Spacing.two, paddingBottom: Spacing.two },
  center: { textAlign: 'center' },
});
