import { useCallback, useState } from 'react';
import {
  fetchBillingUsage,
  openBillingPortal,
  startBillingCheckout,
  type BillingUsageResponse,
} from '@/api/billing-client';
import { useAuth } from '@/store/auth-store';

export function useBilling() {
  const { instance, user } = useAuth();
  const [data, setData] = useState<BillingUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!instance?.baseUrl || instance.mode !== 'cloud' || !user) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchBillingUsage(instance.baseUrl));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [instance?.baseUrl, instance?.mode, user]);

  const openPortal = useCallback(async (): Promise<string | null> => {
    if (!instance?.baseUrl) return null;
    setBusy(true);
    try {
      return await openBillingPortal(instance.baseUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, [instance?.baseUrl]);

  const openCheckout = useCallback(async (): Promise<string | null> => {
    if (!instance?.baseUrl) return null;
    setBusy(true);
    try {
      return await startBillingCheckout(instance.baseUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, [instance?.baseUrl]);

  return { data, loading, error, busy, refresh, openPortal, openCheckout };
}
