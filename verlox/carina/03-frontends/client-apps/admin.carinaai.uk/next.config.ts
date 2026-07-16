import type { NextConfig } from 'next';

const basePath = process.env.ADMIN_BASE_PATH ?? '/business-inner';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: process.cwd(),
  basePath,
};

export default nextConfig;
