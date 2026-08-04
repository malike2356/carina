import { Camera } from 'expo-camera';

export async function requestCameraPermission(): Promise<boolean> {
  const current = await Camera.getCameraPermissionsAsync();
  if (current.granted) return true;
  // If the OS will not show the prompt again, do not pretend we are still asking.
  if (!current.canAskAgain) return false;
  const next = await Camera.requestCameraPermissionsAsync();
  return next.granted;
}

export async function getCameraPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const current = await Camera.getCameraPermissionsAsync();
  if (current.granted) return 'granted';
  if (current.canAskAgain) return 'undetermined';
  return 'denied';
}
