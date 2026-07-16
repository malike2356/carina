import { useCallback, useState } from 'react';
import {
  fetchBillingUsage,
  openBillingPortal,
  startBillingCheckout,
  type BillingUsageResponse,
} from '@/api/billing-client';
import {
  fetchAivaBillingStatus,
  openAivaBillingPortal,
  startAivaCheckout,
  startAivaTopup,
  type AivaBillingStatusView,
} from '@/api/aiva-billing';
import { useCloudFeatureAccess } from '@/hooks/useCloudFeatureAccess';
import { useAuth } from '@/store/auth-store';

export function useBilling() {
  const { instance, user, gatewayAuth } = useAuth();
  const aivaAccess = useCloudFeatureAccess('aiva');
  const [data, setData] = useState<BillingUsageResponse | null>(null);
  const [aiva, setAiva] = useState<AivaBillingStatusView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!instance?.baseUrl || instance.mode !== 'cloud' || !user) {
      setData(null);
      setAiva(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const usagePromise = fetchBillingUsage(instance.baseUrl, gatewayAuth ?? undefined);
      const aivaPromise = aivaAccess.available
        ? fetchAivaBillingStatus(instance.baseUrl, gatewayAuth ?? undefined).catch(() => null)
        : Promise.resolve(null);

      const [usage, aivaStatus] = await Promise.all([usagePromise, aivaPromise]);
      setData(usage);
      setAiva(aivaStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [aivaAccess.available, gatewayAuth, instance?.baseUrl, instance?.mode, user]);

  const openPortal = useCallback(async (): Promise<string | null> => {
    if (!instance?.baseUrl) return null;
    setBusy(true);
    try {
      if (aivaAccess.available) {
        try {
          return await openAivaBillingPortal(instance.baseUrl, gatewayAuth ?? undefined);
        } catch {
          // Fall through to Carina Cloud portal.
        }
      }
      return await openBillingPortal(instance.baseUrl, gatewayAuth ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, [aivaAccess.available, gatewayAuth, instance?.baseUrl]);

  const openCheckout = useCallback(async (): Promise<string | null> => {
    if (!instance?.baseUrl) return null;
    setBusy(true);
    try {
      if (aivaAccess.available) {
        return await startAivaCheckout(instance.baseUrl, 'starter', gatewayAuth ?? undefined);
      }
      return await startBillingCheckout(instance.baseUrl, gatewayAuth ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(false);
    }
  }, [aivaAccess.available, gatewayAuth, instance?.baseUrl]);

  const openTopup = useCallback(
    async (packId: string): Promise<string | null> => {
      if (!instance?.baseUrl) return null;
      setBusy(true);
      try {
        return await startAivaTopup(instance.baseUrl, packId, gatewayAuth ?? undefined);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [gatewayAuth, instance?.baseUrl],
  );

  return {
    data,
    aiva,
    loading,
    error,
    busy,
    refresh,
    openPortal,
    openCheckout,
    openTopup,
    aivaAvailable: aivaAccess.available,
  };
}
