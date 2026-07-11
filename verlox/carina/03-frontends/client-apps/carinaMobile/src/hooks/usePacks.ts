import { useCallback, useState } from 'react';
import {
  installPack,
  listAvailablePacks,
  listInstalledPacks,
  uninstallPack,
} from '@/api/packs-client';
import type { InstalledPack, PackMeta } from '@/api/types';
import {
  assertPackAllowedOnMobile,
  filterMarketplacePacks,
} from '@/config/product-boundaries';
import { useAuth } from '@/store/auth-store';

function filterPackList<T extends { name?: string; pack_name?: string }>(items: T[]): T[] {
  const allowed = new Set(
    filterMarketplacePacks(
      items.map((item) => item.name ?? item.pack_name ?? ''),
    ),
  );
  return items.filter((item) => allowed.has(item.name ?? item.pack_name ?? ''));
}

export function usePacks() {
  const { instance, gatewayAuth } = useAuth();
  const [available, setAvailable] = useState<PackMeta[]>([]);
  const [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyPack, setBusyPack] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!instance?.baseUrl) return;
    setLoading(true);
    setError(null);
    try {
      const [avail, inst] = await Promise.all([
        listAvailablePacks(instance.baseUrl, gatewayAuth ?? undefined),
        listInstalledPacks(instance.baseUrl, gatewayAuth ?? undefined),
      ]);
      setAvailable(filterPackList(avail.packs));
      setInstalled(filterPackList(inst.installed));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [gatewayAuth, instance?.baseUrl]);

  const install = useCallback(
    async (packName: string) => {
      if (!instance?.baseUrl) return;
      setBusyPack(packName);
      setError(null);
      try {
        assertPackAllowedOnMobile(packName);
        await installPack(instance.baseUrl, packName, gatewayAuth ?? undefined);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyPack(null);
      }
    },
    [gatewayAuth, instance?.baseUrl, refresh],
  );

  const uninstall = useCallback(
    async (packName: string) => {
      if (!instance?.baseUrl) return;
      setBusyPack(packName);
      setError(null);
      try {
        await uninstallPack(instance.baseUrl, packName, gatewayAuth ?? undefined);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyPack(null);
      }
    },
    [gatewayAuth, instance?.baseUrl, refresh],
  );

  const isInstalled = useCallback(
    (packName: string) => installed.some((p) => p.pack_name === packName),
    [installed],
  );

  return {
    available,
    installed,
    loading,
    error,
    busyPack,
    refresh,
    install,
    uninstall,
    isInstalled,
  };
}
