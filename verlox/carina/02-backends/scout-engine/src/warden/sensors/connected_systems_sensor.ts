// SSH, API, container, DB probes
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadWardenConfig } from '../config.js';
import type { SensorSignal } from '../types.js';
import { signal } from './util.js';
import { runCommand } from '../arsenal/run.js';

export async function runConnectedSystemsSensor(): Promise<SensorSignal[]> {
  const cfg = loadWardenConfig();
  if (!cfg.sensors.connected_systems) return [];
  const out: SensorSignal[] = [];

  const sshConfig = path.join(os.homedir(), '.ssh', 'config');
  if (fs.existsSync(sshConfig)) {
    const content = fs.readFileSync(sshConfig, 'utf8');
    if (/StrictHostKeyChecking\s+no/i.test(content)) {
      out.push(signal('connected_systems', 'SSH StrictHostKeyChecking disabled', sshConfig, 6, 0.7, {
        artifactPath: sshConfig,
      }));
    }
  }

  const docker = await runCommand('docker', ['ps', '--format', '{{.ID}} {{.Names}} {{.Image}}'], { timeoutMs: 8_000 });
  if (docker.code === 0) {
    const inspect = await runCommand('docker', ['ps', '--filter', 'status=running', '--format', '{{.ID}}'], { timeoutMs: 8_000 });
    for (const id of inspect.stdout.split('\n').filter(Boolean).slice(0, 20)) {
      const detail = await runCommand('docker', ['inspect', '--format', '{{.HostConfig.Privileged}} {{json .HostConfig.Binds}}', id], {
        timeoutMs: 5_000,
      });
      if (detail.stdout.trim().startsWith('true')) {
        out.push(signal('connected_systems', 'Privileged container running', `Container ${id} is privileged`, 8, 0.85, {
          evidence: { id, detail: detail.stdout.trim() },
        }));
      }
    }
  }

  return out;
}
