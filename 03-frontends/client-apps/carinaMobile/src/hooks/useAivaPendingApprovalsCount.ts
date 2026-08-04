import { useCallback, useEffect, useState } from 'react';
import { fetchApprovalsPendingCount } from '@/api/aiva-approvals';
import { useCloudFeatureAccess } from '@/hooks/useCloudFeatureAccess';
import { useAuth } from '@/store/auth-store';

export function useAivaPendingApprovalsCount(pollMs = 60_000): number {
  const { instance, gatewayAuth } = useAuth();
  const aivaAccess = useCloudFeatureAccess('aiva');
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!aivaAccess.available || !instance?.baseUrl || !gatewayAuth?.apiKey) {
      setCount(0);
      return;
    }
    try {
      const next = await fetchApprovalsPendingCount(instance.baseUrl, gatewayAuth);
      setCount(next);
    } catch {
      // Keep last known badge; inbox screen owns hard errors.
    }
  }, [aivaAccess.available, gatewayAuth, instance?.baseUrl]);

  useEffect(() => {
    void refresh();
    if (!aivaAccess.available) return;
    const timer = setInterval(() => {
      void refresh();
    }, pollMs);
    return () => clearInterval(timer);
  }, [aivaAccess.available, pollMs, refresh]);

  return count;
}
