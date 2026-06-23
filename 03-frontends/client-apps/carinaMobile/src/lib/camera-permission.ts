import { Camera } from 'expo-camera';

export async function requestCameraPermission(): Promise<boolean> {
  const current = await Camera.getCameraPermissionsAsync();
  if (current.granted) return true;
  const next = await Camera.requestCameraPermissionsAsync();
  return next.granted;
}

export async function getCameraPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const current = await Camera.getCameraPermissionsAsync();
  if (current.granted) return 'granted';
  if (current.canAskAgain) return 'undetermined';
  return 'denied';
}
