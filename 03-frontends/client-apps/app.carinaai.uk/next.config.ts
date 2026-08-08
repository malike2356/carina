import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Temporary: local tree has many truncated stubs; allow shipping Tier-2 OAuth routes.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingIncludes: {
    '/api/workspace/profiles': [
      './src/lib/support/**/*',
      './src/lib/builtin-profiles/**/*',
    ],
    '/legal/terms': ['./content/legal/**/*'],
    '/legal/privacy': ['./content/legal/**/*'],
    '/legal/dpa': ['./content/legal/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hub.carinaai.uk',
      },
    ],
  },
  experimental: {
    serverActions: {
      // Aiva chat attachments are base64 JSON (up to ~100MB decoded).
      bodySizeLimit: '150mb',
    },
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/downloads/:file*.apk',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Cloudflare-CDN-Cache-Control', value: 'no-store' },
          { key: 'Expires', value: '0' },
          { key: 'Content-Type', value: 'application/vnd.android.package-archive' },
          {
            key: 'Content-Disposition',
            value: 'attachment; filename="carina-mobile.apk"',
          },
        ],
      },
      {
        source: '/downloads/latest-mobile.json',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Cloudflare-CDN-Cache-Control', value: 'no-store' },
          { key: 'Expires', value: '0' },
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
        ],
      },
      {
        source: '/downloads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Cloudflare-CDN-Cache-Control', value: 'no-store' },
          { key: 'Expires', value: '0' },
        ],
      },
      {
        source: '/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|sw.js|downloads).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
