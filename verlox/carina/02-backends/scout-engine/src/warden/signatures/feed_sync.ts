// Auto-update threat intel feeds
import fs from 'node:fs';
import path from 'node:path';
import { loadWardenConfig } from '../config.js';

export async function syncThreatFeeds(opts: { ipUrl?: string; domainUrl?: string } = {}): Promise<{ ok: boolean; message: string }> {
  const cfg = loadWardenConfig();
  const updates: string[] = [];
  try {
    if (opts.ipUrl) {
      const res = await fetch(opts.ipUrl);
      const text = await res.text();
      fs.writeFileSync(path.join(cfg.signatures_dir, 'ip_blocklist.txt'), text);
      updates.push('ip_blocklist');
    }
    if (opts.domainUrl) {
      const res = await fetch(opts.domainUrl);
      const text = await res.text();
      fs.writeFileSync(path.join(cfg.signatures_dir, 'domain_blocklist.txt'), text);
      updates.push('domain_blocklist');
    }
    return { ok: true, message: updates.length ? `Updated ${updates.join(', ')}` : 'No feed URLs provided' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}
