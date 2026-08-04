import { DEFAULT_CLOUD_URL } from '@/config/defaults';

export interface MobileReleaseManifest {
  platform?: 'android' | 'ios' | string;
  version?: string;
  build?: string;
  apkUrl?: string;
  sha256?: string;
  updatedAt?: string;
  minSupportedVersion?: string;
  releaseNotes?: string[];
}

export interface MobileUpdateState {
  installedVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  updateRequired: boolean;
  downloadUrl: string;
  releaseNotes: string[];
  manifest: MobileReleaseManifest;
}

function versionParts(version: string): number[] {
  return version
    .split(/[.+-]/)
    .map((part) => {
      const match = part.match(/\d+/);
      return match ? Number(match[0]) : 0;
    });
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length, 3);

  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }

  return 0;
}

export function resolveMobileDownloadUrl(
  manifest: MobileReleaseManifest,
  cloudUrl = DEFAULT_CLOUD_URL,
): string {
  const apkUrl = manifest.apkUrl?.trim() || '/downloads/carina-mobile.apk';
  if (/^https?:\/\//i.test(apkUrl)) return apkUrl;

  const base = cloudUrl.replace(/\/+$/, '');
  const path = apkUrl.startsWith('/') ? apkUrl : `/${apkUrl}`;
  return `${base}${path}`;
}

export function buildMobileUpdateState(
  installedVersion: string,
  manifest: MobileReleaseManifest,
  cloudUrl = DEFAULT_CLOUD_URL,
): MobileUpdateState | null {
  const latestVersion = manifest.version?.trim();
  if (!latestVersion) return null;

  const cleanInstalled = installedVersion.trim() || '0.0.0';
  const minSupported = manifest.minSupportedVersion?.trim();

  return {
    installedVersion: cleanInstalled,
    latestVersion,
    updateAvailable: compareVersions(cleanInstalled, latestVersion) < 0,
    updateRequired: minSupported ? compareVersions(cleanInstalled, minSupported) < 0 : false,
    downloadUrl: resolveMobileDownloadUrl(manifest, cloudUrl),
    releaseNotes: Array.isArray(manifest.releaseNotes) ? manifest.releaseNotes.filter(Boolean) : [],
    manifest,
  };
}

export async function fetchMobileReleaseManifest(
  cloudUrl = DEFAULT_CLOUD_URL,
): Promise<MobileReleaseManifest | null> {
  const url = `${cloudUrl.replace(/\/+$/, '')}/downloads/latest-mobile.json`;
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json() as Promise<MobileReleaseManifest>;
}
