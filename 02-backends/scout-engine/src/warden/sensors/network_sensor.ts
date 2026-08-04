// Network monitoring
import fs from 'node:fs';
import path from 'node:path';
import { loadWardenConfig } from '../config.js';
import type { SensorSignal } from '../types.js';
import { signal } from './util.js';
import { runCommand } from '../arsenal/run.js';

function loadLines(filePath: string): Set<string> {
  if (!fs.existsSync(filePath)) return new Set();
  return new Set(
    fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
}

export async function runNetworkSensor(): Promise<SensorSignal[]> {
  const cfg = loadWardenConfig();
  if (!cfg.sensors.network) return [];
  const out: SensorSignal[] = [];
  const ipBlock = loadLines(path.join(cfg.signatures_dir, 'ip_blocklist.txt'));
  const domainBlock = loadLines(path.join(cfg.signatures_dir, 'domain_blocklist.txt'));

  const ss = await runCommand('ss', ['-Htantup'], { timeoutMs: 5_000 });
  for (const line of ss.stdout.split('\n').filter(Boolean).slice(0, 400)) {
    const m = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)\s+(\d+\.\d+\.\d+\.\d+):(\d+)/);
    if (!m) continue;
    const remoteIp = m[3];
    const remotePort = Number(m[4]);
    if (ipBlock.has(remoteIp)) {
      out.push(signal('network', 'Connection to blocklisted IP', line.trim().slice(0, 300), 9, 0.9, {
        remoteIp,
        evidence: { line: line.trim() },
      }));
    }
    if (
      remotePort &&
      !cfg.network.connection_whitelist_ports.includes(remotePort) &&
      remotePort > 1024 &&
      /ESTAB/.test(line)
    ) {
      // only flag uncommon high ports with low confidence
      if (remotePort === 4444 || remotePort === 1337 || remotePort === 31337) {
        out.push(signal('network', 'Suspicious listening/outbound port', line.trim().slice(0, 300), 6, 0.55, {
          remoteIp,
          evidence: { remotePort },
        }));
      }
    }
  }

  // DNS via resolv / systemd-resolve optional
  if (fs.existsSync('/var/log/syslog')) {
    // skip heavy parse by default
  }

  for (const domain of domainBlock) {
    // placeholder presence check only; live DNS tap is async infra
    void domain;
  }

  return out;
}
