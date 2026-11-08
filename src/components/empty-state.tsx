import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/logo-mark';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ title, message, action }: Props) {
  return (
    <View style={styles.root}>
      <LogoMark size={34} />
      <View style={styles.copy}>
        <ThemedText type="title" style={styles.center}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          {message}
        </ThemedText>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four, paddingHorizontal: Spacing.four, paddingVertical: Spacing.six },
  copy: { gap: Spacing.two, maxWidth: 320 },
  center: { textAlign: 'center' },
  action: { alignSelf: 'stretch' },
});
