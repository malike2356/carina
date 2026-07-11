import * as SecureStore from 'expo-secure-store';
import { storageKeyForUrl } from '@/lib/url-utils';

function secureKey(baseUrl: string): string {
  return `carina.cloud.session.${storageKeyForUrl(baseUrl)}`;
}

export async function loadCloudSessionToken(baseUrl: string): Promise<string | null> {
  if (!baseUrl) return null;
  try {
    return await SecureStore.getItemAsync(secureKey(baseUrl));
  } catch {
    return null;
  }
}

export async function saveCloudSessionToken(baseUrl: string, token: string): Promise<void> {
  const trimmed = token.trim();
  if (!baseUrl || !trimmed) return;
  await SecureStore.setItemAsync(secureKey(baseUrl), trimmed);
}

export async function clearCloudSessionToken(baseUrl: string): Promise<void> {
  if (!baseUrl) return;
  try {
    await SecureStore.deleteItemAsync(secureKey(baseUrl));
  } catch {
    // key may not exist
  }
}
