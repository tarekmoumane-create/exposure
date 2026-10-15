import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const colors = Colors.light;

  return (
    <NativeTabs
      backgroundColor={colors.background}
      tintColor={colors.text}
      iconColor={{ default: colors.textTertiary, selected: colors.text }}
      labelStyle={{ default: { color: colors.textTertiary }, selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="studio">
        <NativeTabs.Trigger.Icon sf={{ default: 'camera', selected: 'camera.fill' }} md="photo_camera" />
        <NativeTabs.Trigger.Label>Studio</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'flame', selected: 'flame.fill' }} md="local_fire_department" />
        <NativeTabs.Trigger.Label>Looks</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="library">
        <NativeTabs.Trigger.Icon sf={{ default: 'photo.on.rectangle', selected: 'photo.fill.on.rectangle.fill' }} md="photo_library" />
        <NativeTabs.Trigger.Label>Gallery</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
