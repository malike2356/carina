// Dependency / package audit
import fs from 'node:fs';
import path from 'node:path';
import { getEngineRoot, loadWardenConfig } from '../config.js';
import type { SensorSignal } from '../types.js';
import { signal } from './util.js';
import { runCommand } from '../arsenal/run.js';

export async function runSupplyChainSensor(): Promise<SensorSignal[]> {
  const cfg = loadWardenConfig();
  if (!cfg.sensors.supply_chain) return [];
  const out: SensorSignal[] = [];
  const root = getEngineRoot();
  const pkgLock = path.join(root, 'package-lock.json');
  const pnpmLock = path.join(root, 'pnpm-lock.yaml');

  if (!fs.existsSync(pkgLock) && !fs.existsSync(pnpmLock)) {
    out.push(signal('supply_chain', 'No lockfile present', 'Package lockfile missing for Scout engine', 6, 0.7));
  }

  const npmAudit = await runCommand('npm', ['audit', '--json'], { timeoutMs: 60_000, cwd: root });
  if (npmAudit.code !== null && npmAudit.stdout.trim().startsWith('{')) {
    try {
      const json = JSON.parse(npmAudit.stdout) as { metadata?: { vulnerabilities?: Record<string, number> } };
      const vulns = json.metadata?.vulnerabilities ?? {};
      const critical = Number(vulns.critical || 0);
      const high = Number(vulns.high || 0);
      if (critical > 0 || high > 0) {
        out.push(signal(
          'supply_chain',
          'npm audit high/critical findings',
          `critical=${critical} high=${high}`,
          critical > 0 ? 8 : 6,
          0.8,
          { evidence: vulns },
        ));
      }
    } catch {
      // ignore parse errors
    }
  }

  return out;
}
