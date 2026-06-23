import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'carina.biometric.enabled';

export async function loadBiometricEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ENABLED_KEY);
  return raw === 'true';
}

export async function saveBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
}
