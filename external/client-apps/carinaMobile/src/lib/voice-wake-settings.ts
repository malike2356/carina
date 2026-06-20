import AsyncStorage from '@react-native-async-storage/async-storage';

export const VOICE_WAKE_ENABLED_KEY = 'voice-wake-enabled';
export const VOICE_WAKE_PRIVACY_START_KEY = 'voice-wake-privacy-start';
export const VOICE_WAKE_PRIVACY_END_KEY = 'voice-wake-privacy-end';
export const VOICE_WAKE_COUNT_KEY = 'voice-wake-count';

export const DEFAULT_PRIVACY_START = 22;
export const DEFAULT_PRIVACY_END = 7;
export const WAKE_PHRASE = 'hey carina';

export interface VoiceWakeSettings {
  enabled: boolean;
  privacyStart: number;
  privacyEnd: number;
  wakeCount: number;
}

export function isPrivacyHour(
  hour: number,
  privacyStart: number,
  privacyEnd: number,
): boolean {
  if (privacyStart === privacyEnd) return false;
  if (privacyStart > privacyEnd) {
    return hour >= privacyStart || hour < privacyEnd;
  }
  return hour >= privacyStart && hour < privacyEnd;
}

export function containsWakePhrase(transcript: string, phrase = WAKE_PHRASE): boolean {
  return transcript.toLowerCase().replace(/\s+/g, ' ').includes(phrase);
}

export async function loadVoiceWakeSettings(): Promise<VoiceWakeSettings> {
  const [enabledRaw, startRaw, endRaw, countRaw] = await Promise.all([
    AsyncStorage.getItem(VOICE_WAKE_ENABLED_KEY),
    AsyncStorage.getItem(VOICE_WAKE_PRIVACY_START_KEY),
    AsyncStorage.getItem(VOICE_WAKE_PRIVACY_END_KEY),
    AsyncStorage.getItem(VOICE_WAKE_COUNT_KEY),
  ]);

  return {
    enabled: enabledRaw !== 'false',
    privacyStart: startRaw != null ? Number(startRaw) : DEFAULT_PRIVACY_START,
    privacyEnd: endRaw != null ? Number(endRaw) : DEFAULT_PRIVACY_END,
    wakeCount: countRaw != null ? Number(countRaw) : 0,
  };
}

export async function saveVoiceWakeEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(VOICE_WAKE_ENABLED_KEY, String(enabled));
}

export async function incrementWakeCount(): Promise<number> {
  const current = Number(await AsyncStorage.getItem(VOICE_WAKE_COUNT_KEY) ?? '0');
  const next = current + 1;
  await AsyncStorage.setItem(VOICE_WAKE_COUNT_KEY, String(next));
  return next;
}
