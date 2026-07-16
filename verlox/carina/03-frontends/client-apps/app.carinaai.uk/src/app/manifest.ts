import type { MetadataRoute } from 'next';
import { getPublicBrand, getRequestHostname } from '@/lib/server-brand';
import { resolveHostBrandContext } from '@/lib/host-resolver';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const hostname = await getRequestHostname();
  const hostContext = await resolveHostBrandContext(hostname);
  const brand = hostContext.isAivaProduct
    ? hostContext.resolvedBrand
    : await getPublicBrand();
  const isAiva = hostContext.isAivaProduct;
  const accent = brand.colorTokens?.['--accent'] ?? (isAiva ? '#22c55e' : '#16c97e');
  const iconSrc = brand.faviconUrl ?? '/favicon.svg';

  return {
    name: isAiva ? 'Aiva' : brand.publicSiteTitle,
    short_name: isAiva ? 'Aiva' : brand.shortName,
    description: isAiva
      ? 'Hire and manage AI employees for your business.'
      : `Hosted ${brand.productName} workspace for chat, research, documents, email, and more.`,
    start_url: isAiva ? '/aiva/workers' : '/',
    scope: '/',
    display: 'standalone',
    background_color: isAiva ? '#ffffff' : '#0f1117',
    theme_color: accent,
    icons: [
      {
        src: iconSrc,
        sizes: 'any',
        type: iconSrc.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
        purpose: 'any',
      },
      {
        src: iconSrc,
        sizes: 'any',
        type: iconSrc.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
