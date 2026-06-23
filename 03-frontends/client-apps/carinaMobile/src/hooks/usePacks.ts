import { useCallback, useState } from 'react';
import {
  installPack,
  listAvailablePacks,
  listInstalledPacks,
  uninstallPack,
} from '@/api/packs-client';
import type { InstalledPack, PackMeta } from '@/api/types';
import { isPackAllowedOnMobile } from '@/config/product-boundaries';
import { useAuth } from '@/store/auth-store';

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
      setAvailable(avail.packs.filter((p) => isPackAllowedOnMobile(p.name)));
      setInstalled(inst.installed.filter((p) => isPackAllowedOnMobile(p.pack_name)));
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
      try {
        await installPack(instance.baseUrl, packName, gatewayAuth ?? undefined);
        await refresh();
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
      try {
        await uninstallPack(instance.baseUrl, packName, gatewayAuth ?? undefined);
        await refresh();
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
