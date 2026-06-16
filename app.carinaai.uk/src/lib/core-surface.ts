export function resolveCoreSurfaceUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_CARINA_CORE_URL?.trim() ||
    'https://core.carinaai.uk';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base.replace(/\/$/, '')}${normalized}`;
}

export function coreSurfaceDeepLinkEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_CORE_SURFACE === 'true';
}

export type CoreSurface = 'email' | 'documents' | 'calendar';
