import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY = 'exposure.device';

let cached: string | null = null;

/**
 * A random id for this phone, kept in the keychain so the one free photo is not handed out again
 * after a reinstall. iOS usually keeps keychain items across reinstalls but does not promise to.
 */
export async function getDeviceId(): Promise<string | null> {
  if (cached) return cached;
  try {
    cached = (await SecureStore.getItemAsync(KEY)) ?? Crypto.randomUUID();
    await SecureStore.setItemAsync(KEY, cached);
    return cached;
  } catch {
    return null;
  }
}
