import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  evaluateNativeCapabilities,
  type NativeCapabilityStatus,
} from '@/lib/native-capabilities';

export function useNativeCapabilities(): NativeCapabilityStatus {
  return useMemo(
    () =>
      evaluateNativeCapabilities({
        appOwnership: Constants.appOwnership ?? null,
        isDevice: Device.isDevice,
        easProjectId:
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId,
        platform: Platform.OS,
      }),
    [],
  );
}
