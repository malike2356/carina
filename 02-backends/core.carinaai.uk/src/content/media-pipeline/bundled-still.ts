import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { propertyChannelStoreDir } from '../../lib/property-channel-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Phase A placeholder still (SVG). Production stock replaces this directory
 * later; the compositor converts SVG/PNG via ffmpeg when needed.
 */
export function resolveBundledPlaceholderStill(): string {
  const bundled = path.join(__dirname, 'assets', 'property-still-placeholder.svg');
  if (fs.existsSync(bundled)) return bundled;
  const runtimeDir = path.join(propertyChannelStoreDir(), 'media', 'stills');
  fs.mkdirSync(runtimeDir, { recursive: true });
  const fallback = path.join(runtimeDir, 'property-still-placeholder.svg');
  if (!fs.existsSync(fallback)) {
    fs.writeFileSync(
      fallback,
      `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e3a5f"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#g)"/>
  <rect x="80" y="780" width="1760" height="220" fill="#020617" opacity="0.55"/>
  <text x="960" y="140" text-anchor="middle" fill="#e2e8f0" font-family="Arial,sans-serif" font-size="56" font-weight="700">Channel</text>
</svg>`,
    );
  }
  return fallback;
}
