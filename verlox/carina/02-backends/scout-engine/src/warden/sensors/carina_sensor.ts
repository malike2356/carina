// Carina runtime monitoring
import fs from 'node:fs';
import { loadWardenConfig } from '../config.js';
import type { SensorSignal } from '../types.js';
import { signal } from './util.js';
import { runCommand } from '../arsenal/run.js';

export async function runCarinaSensor(): Promise<SensorSignal[]> {
  const cfg = loadWardenConfig();
  if (!cfg.sensors.carina) return [];
  const out: SensorSignal[] = [];

  const ps = await runCommand('ps', ['-eo', 'pid,comm,args', '--no-headers'], { timeoutMs: 5_000 });
  const lines = ps.stdout.split('\n').filter(Boolean);
  const hints = cfg.carina.process_name_hints.map((h) => h.toLowerCase());
  const carinaProcs = lines.filter((line) => hints.some((h) => line.toLowerCase().includes(h)));

  if (carinaProcs.length === 0) {
    out.push(signal('carina', 'Carina process not observed', 'No matching Carina process hints in process list', 2, 0.4));
  }

  for (const line of carinaProcs.slice(0, 20)) {
    const pid = Number(line.trim().split(/\s+/)[0]);
    if (!Number.isFinite(pid)) continue;
    const mapsPath = `/proc/${pid}/maps`;
    if (fs.existsSync(mapsPath)) {
      const maps = fs.readFileSync(mapsPath, 'utf8');
      if (/^[0-9a-f]+-[0-9a-f]+ rwx/im.test(maps) || / rwxp /.test(maps)) {
        out.push(signal(
          'carina',
          'Anonymous executable mapping in Carina process',
          `PID ${pid} has rwx mapping (possible code injection)`,
          8,
          0.7,
          { processId: pid, evidence: { mapsSample: maps.split('\n').slice(0, 5) } },
        ));
      }
    }
  }

  for (const watch of cfg.carina.watch_paths) {
    if (!fs.existsSync(watch)) {
      out.push(signal('carina', 'Missing Carina watch path', `Expected path missing: ${watch}`, 5, 0.6, { artifactPath: watch }));
    }
  }

  return out;
}
