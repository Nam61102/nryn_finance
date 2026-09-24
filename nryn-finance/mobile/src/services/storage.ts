import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * expo-secure-store has no web implementation — calling it in a browser throws.
 * On web we fall back to localStorage, which is fine for a dev dashboard on
 * your own machine but is NOT secure storage. The phone build still uses the
 * real keystore-backed SecureStore.
 */
const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try { window.localStorage.setItem(key, value); } catch { /* private mode */ }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
