// Host server monitoring
import fs from 'node:fs';
import { loadWardenConfig } from '../config.js';
import type { SensorSignal } from '../types.js';
import { signal } from './util.js';
import { runCommand } from '../arsenal/run.js';

export async function runHostSensor(deep = false): Promise<SensorSignal[]> {
  const cfg = loadWardenConfig();
  if (!cfg.sensors.host) return [];
  const out: SensorSignal[] = [];

  if (fs.existsSync('/etc/ld.so.preload')) {
    const content = fs.readFileSync('/etc/ld.so.preload', 'utf8').trim();
    if (content) {
      out.push(signal('host', 'ld.so.preload entries present', content.slice(0, 500), 10, 0.95, {
        artifactPath: '/etc/ld.so.preload',
        evidence: { content },
      }));
    }
  }

  const ps = await runCommand('ps', ['-eo', 'pid,user,args', '--no-headers'], { timeoutMs: 5_000 });
  for (const line of ps.stdout.split('\n')) {
    if (/\/(tmp|dev\/shm|var\/tmp)\//.test(line) && /\b(bash|sh|python|perl|nc|ncat|curl|wget)\b/.test(line)) {
      const pid = Number(line.trim().split(/\s+/)[0]);
      out.push(signal('host', 'Suspicious process from temp path', line.trim().slice(0, 300), 7, 0.7, {
        processId: Number.isFinite(pid) ? pid : undefined,
      }));
    }
  }

  // Hidden process heuristic: compare /proc count vs ps count (lightweight)
  let procCount = 0;
  try {
    procCount = fs.readdirSync('/proc').filter((n) => /^\d+$/.test(n)).length;
  } catch {
    procCount = 0;
  }
  const psCount = ps.stdout.split('\n').filter(Boolean).length;
  if (procCount > 0 && psCount > 0 && procCount - psCount > 15) {
    out.push(signal(
      'host',
      'Possible hidden processes',
      `/proc has ${procCount} PIDs vs ps ${psCount}`,
      8,
      0.55,
      { evidence: { procCount, psCount } },
    ));
  }

  if (deep) {
    const users = await runCommand('getent', ['passwd'], { timeoutMs: 5_000 });
    for (const line of users.stdout.split('\n')) {
      const parts = line.split(':');
      if (parts.length >= 3 && parts[2] === '0' && parts[0] !== 'root') {
        out.push(signal('host', 'Non-root UID 0 account', `Account ${parts[0]} has UID 0`, 10, 0.99));
      }
    }
  }

  return out;
}
