import type { MetadataRoute } from 'next';
import { getPublicBrand } from '@/lib/server-brand';

export default function manifest(): MetadataRoute.Manifest {
  const brand = getPublicBrand();
  const accent = brand.colorTokens['--accent'] ?? '#16c97e';
  return {
    name: brand.publicSiteTitle,
    short_name: brand.shortName,
    description: `Hosted ${brand.productName} workspace for chat, research, documents, email, and more.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0d0d0f',
    theme_color: accent,
    icons: [
      {
        src: brand.faviconUrl ?? '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
