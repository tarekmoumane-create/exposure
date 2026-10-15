import { router } from 'expo-router';

/** Closes the current screen, falling back to home when there is no history (deep links, web). */
export function dismiss() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
