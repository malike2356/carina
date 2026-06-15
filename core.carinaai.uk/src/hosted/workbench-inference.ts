import { isProviderConfigured, PROVIDER_MAP } from '../brain/provider-registry.js';
import { getTenantProvider } from '../brain/tenant-provider-keys.js';
import { config } from '../config/index.js';

export type WorkbenchInferenceMode = 'byok' | 'managed';
export type WorkbenchInferencePreference = 'auto' | WorkbenchInferenceMode;

export function isManagedWorkbenchEnabled(): boolean {
  return config.carinaOps.managedWorkbenchEnabled;
}

export function isPlatformProviderAvailable(provider: string): boolean {
  const def = PROVIDER_MAP[provider];
  return def ? isProviderConfigured(def) : false;
}

export async function resolveWorkbenchInferenceMode(
  tenantId: string,
  provider: string,
  preference: WorkbenchInferencePreference = 'auto',
): Promise<WorkbenchInferenceMode | null> {
  const hasByok = Boolean(await getTenantProvider(tenantId, provider));
  const hasManaged = isManagedWorkbenchEnabled() && isPlatformProviderAvailable(provider);

  if (preference === 'byok') {
    return hasByok ? 'byok' : null;
  }
  if (preference === 'managed') {
    return hasManaged ? 'managed' : null;
  }
  if (hasByok) return 'byok';
  if (hasManaged) return 'managed';
  return null;
}

export async function getWorkbenchInferenceCapabilities(
  tenantId: string,
  provider: string,
): Promise<{ byok: boolean; managed: boolean; inferenceMode: WorkbenchInferenceMode | null }> {
  const byok = Boolean(await getTenantProvider(tenantId, provider));
  const managed = isManagedWorkbenchEnabled() && isPlatformProviderAvailable(provider);
  const inferenceMode = await resolveWorkbenchInferenceMode(tenantId, provider, 'auto');
  return { byok, managed, inferenceMode };
}
