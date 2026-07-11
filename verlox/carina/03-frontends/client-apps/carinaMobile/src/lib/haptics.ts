import { Platform } from 'react-native';

let hapticsModule: typeof import('expo-haptics') | null = null;

async function loadHaptics(): Promise<typeof import('expo-haptics') | null> {
  if (Platform.OS === 'web') return null;
  if (hapticsModule) return hapticsModule;
  try {
    hapticsModule = await import('expo-haptics');
    return hapticsModule;
  } catch {
    return null;
  }
}

export async function hapticLight(): Promise<void> {
  const haptics = await loadHaptics();
  if (!haptics) return;
  await haptics.impactAsync(haptics.ImpactFeedbackStyle.Light);
}

export async function hapticMedium(): Promise<void> {
  const haptics = await loadHaptics();
  if (!haptics) return;
  await haptics.impactAsync(haptics.ImpactFeedbackStyle.Medium);
}

export async function hapticSuccess(): Promise<void> {
  const haptics = await loadHaptics();
  if (!haptics) return;
  await haptics.notificationAsync(haptics.NotificationFeedbackType.Success);
}

export async function hapticError(): Promise<void> {
  const haptics = await loadHaptics();
  if (!haptics) return;
  await haptics.notificationAsync(haptics.NotificationFeedbackType.Error);
}

export async function hapticSelection(): Promise<void> {
  const haptics = await loadHaptics();
  if (!haptics) return;
  await haptics.selectionAsync();
}
