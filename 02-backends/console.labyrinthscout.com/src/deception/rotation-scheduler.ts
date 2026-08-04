import { movingTarget, type MovingTarget } from './moving-target.js';
import type { RotationConfig } from './deception-config.js';
import { DEFAULT_ROTATION_CONFIG } from './deception-config.js';
import { pool } from '../db.js';
import { honeypotManager } from '../security/honeypot-manager.js';

let markerTimer: ReturnType<typeof setInterval> | null = null;
let decoyTimer: ReturnType<typeof setInterval> | null = null;
let toolNameTimer: ReturnType<typeof setInterval> | null = null;

export function startRotationScheduler(
  config: Partial<RotationConfig> = {},
  target: MovingTarget = movingTarget,
): void {
  const cfg = { ...DEFAULT_ROTATION_CONFIG, ...config };

  markerTimer = setInterval(() => {
    void target.rotateMarker().catch((err) => {
      console.error('[RotationScheduler] Marker rotation failed:', err);
    });
  }, cfg.marker_interval_minutes * 60 * 1000);

  // Decoy rotation: every N minutes (default 60), retire each active
  // instance's decoy honeypot set and generate a fresh one. Retired decoys
  // stay in HoneypotManager's leak-detection scan window for 24 hours so
  // delayed leaks are still caught (see HoneypotManager.rotate/scanForLeak).
  decoyTimer = setInterval(() => {
    void rotateAllHoneypots().catch((err) => {
      console.error('[RotationScheduler] Honeypot rotation failed:', err);
    });
  }, cfg.decoy_rotation_minutes * 60 * 1000);

  toolNameTimer = setInterval(() => {
    target.rotateToolNames();
  }, cfg.tool_name_rotation_minutes * 60 * 1000);
}

async function rotateAllHoneypots(): Promise<void> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM carina_instances WHERE status = 'active'`,
  );
  for (const row of result.rows) {
    await honeypotManager.rotate(row.id);
  }
}

export function stopRotationScheduler(): void {
  if (markerTimer) clearInterval(markerTimer);
  if (decoyTimer) clearInterval(decoyTimer);
  if (toolNameTimer) clearInterval(toolNameTimer);
  markerTimer = null;
  decoyTimer = null;
  toolNameTimer = null;
}
