import { useMemo } from 'react';
import {
  cloudFeatureAccess,
  type CloudFeatureAccess,
  type CloudFeatureId,
} from '@/lib/cloud-features';
import { useAuth } from '@/store/auth-store';

export function useCloudFeatureAccess(feature: CloudFeatureId): CloudFeatureAccess {
  const { instance, user } = useAuth();
  return useMemo(
    () => cloudFeatureAccess(feature, instance, user),
    [feature, instance, user],
  );
}
