#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[smoke] responsive frame breakpoints"
pnpm exec tsx -e "
import { computeResponsiveFrame } from './src/tui/responsive-frame.ts';
for (const [cols, rows] of [[60, 20], [90, 24], [132, 32]]) {
  const frame = computeResponsiveFrame(cols, rows);
  console.log('  ' + cols + 'x' + rows + ' -> ' + frame.mode + ' twoColumn=' + frame.twoColumn + ' body=' + frame.bodyHeight);
}
"

echo "[smoke] vitest launcher render checks"
pnpm exec vitest run src/tui/responsive-frame.test.ts src/tui/layout.test.ts src/tui/ink/launcher/launcher-responsive.smoke.test.tsx

echo "[smoke] done"
