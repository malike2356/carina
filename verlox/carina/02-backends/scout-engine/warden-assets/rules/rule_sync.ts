// Auto-update rules from community feeds (opt-in)
import fs from 'node:fs';
import path from 'node:path';
import { loadWardenConfig } from '../config.js';

export async function syncCommunityRules(feedUrl?: string): Promise<{ ok: boolean; message: string }> {
  const cfg = loadWardenConfig();
  const dest = path.join(cfg.rules_dir, 'community');
  fs.mkdirSync(dest, { recursive: true });
  if (!feedUrl) {
    return { ok: true, message: 'No feed URL configured; community rules directory ready' };
  }
  try {
    const res = await fetch(feedUrl);
    if (!res.ok) return { ok: false, message: `Feed HTTP ${res.status}` };
    const body = await res.text();
    const out = path.join(dest, `synced-${Date.now()}.yar`);
    fs.writeFileSync(out, body);
    return { ok: true, message: `Wrote ${out}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}
