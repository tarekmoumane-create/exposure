import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

export default function AppTabs() {
  const colors = Colors.light;
  const { printConfig, orders } = useAppStore();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      tintColor={colors.brand}
      iconColor={{ default: colors.textTertiary, selected: colors.brand }}
      labelStyle={{ default: { color: colors.textTertiary }, selected: { color: colors.brand } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.stack', selected: 'square.stack.fill' }} md="photo_library" />
        <NativeTabs.Trigger.Label>Rolls</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stocks">
        <NativeTabs.Trigger.Icon sf={{ default: 'camera.aperture', selected: 'camera.aperture' }} md="camera" />
        <NativeTabs.Trigger.Label>Looks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="prints" hidden={!printConfig.enabled && orders.length === 0}>
        <NativeTabs.Trigger.Icon sf={{ default: 'envelope', selected: 'envelope.fill' }} md="mail" />
        <NativeTabs.Trigger.Label>Prints</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
