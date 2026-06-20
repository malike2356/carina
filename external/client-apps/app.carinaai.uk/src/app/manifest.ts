import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Carina Cloud',
    short_name: 'Carina',
    description: 'Hosted Carina workspace for chat, research, documents, email, and more.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0d0d0f',
    theme_color: '#16c97e',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
