import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/workspace/profiles': [
      './src/lib/support/**/*',
      './src/lib/builtin-profiles/**/*',
    ],
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
      bodySizeLimit: '2mb',
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
        source: '/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|sw.js).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },
};

export default nextConfig;
