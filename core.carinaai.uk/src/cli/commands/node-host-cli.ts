import chalk from 'chalk';
import fs from 'fs';
import os from 'os';
import {
  clearNodeHostPid,
  installNodeHostSystemdUnit,
  isNodeHostRunning,
  loadLocalNodeConfig,
  nodeHostConfigPath,
  nodeHostPidFile,
  readNodeHostPid,
  removeLocalNodeConfig,
  saveLocalNodeConfig,
  systemdNodeHostUnitPath,
  systemdUserCtl,
  uninstallNodeHostSystemdUnit,
  writeNodeHostPid,
} from '../../infrastructure/node-host/service.js';
import { runNodeDaemon } from '../../infrastructure/node-host/daemon.js';
import { formatPairingQrTerminal, buildNodePairQrPayload } from '../../infrastructure/node-host/qr.js';
import { readRecentNodeAudit } from '../../infrastructure/node-host/audit.js';
import { explainNodeFilePolicy } from '../../security/node-file-policy.js';
import { loadLocalEnv } from '../config/env.js';

async function trySystemd(action: 'start' | 'stop' | 'restart' | 'status'): Promise<boolean> {
  const unit = systemdNodeHostUnitPath();
  if (!fs.existsSync(unit)) return false;
  try {
    const out = await systemdUserCtl(action);
    if (out) console.log(out);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`systemctl --user ${action} failed: ${msg}`));
    return false;
  }
}

async function postJson(url: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

export async function runNodeHostCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';
  const rest = args.slice(1);

  if (action === 'status') {
    const config = loadLocalNodeConfig();
    const running = isNodeHostRunning();
    const mode = config ? 'remote (paired to gateway)' : 'local (not paired)';
    console.log(chalk.bold('\nCarina node host\n'));
    console.log(`  mode: ${mode}`);
    console.log(`  running: ${running ? chalk.green('yes') : chalk.yellow('no')}`);
    console.log(`  pid: ${readNodeHostPid() ?? '-'}`);
    console.log(`  config: ${config ? nodeHostConfigPath() : 'not paired'}`);
    if (config) {
      console.log(`  gateway: ${config.gatewayUrl}`);
      console.log(`  node id: ${config.nodeId}`);
      console.log(`  name: ${config.name}`);
    }
    const unit = systemdNodeHostUnitPath();
    console.log(`  systemd unit: ${fs.existsSync(unit) ? unit : 'not installed'}`);
    console.log(chalk.gray('\nFile policy:'));
    console.log(chalk.gray(explainNodeFilePolicy().split('\n').map((l) => `  ${l}`).join('\n')));
    console.log(chalk.gray('\nGateway operator: carina ops control status | carina pairing nodes\n'));
    return;
  }

  if (action === 'audit') {
    const limit = Number(rest.find((a) => /^\d+$/.test(a)) ?? 30);
    const rows = readRecentNodeAudit(limit);
    if (rows.length === 0) {
      console.log('No node audit events.');
      return;
    }
    for (const row of rows) {
      console.log(`${row.at}  ${row.action}  ${row.nodeId ?? '-'}  ${row.detail ?? ''}`);
    }
    return;
  }

  if (action === 'pair') {
    const gatewayUrl = rest.find((a) => !a.startsWith('--')) ?? process.env.CARINA_GATEWAY_URL;
    if (!gatewayUrl) {
      console.error('Usage: carina node-host pair <gateway-url>');
      console.error('Or set CARINA_GATEWAY_URL');
      process.exit(1);
    }
    const base = gatewayUrl.replace(/\/$/, '');
    const res = await postJson(`${base}/api/nodes/pair/request`, {
      name: os.hostname(),
      hostname: os.hostname(),
      platform: `${process.platform}/${process.arch}`,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Pairing request failed (${res.status}): ${err}`);
      console.error('Ensure CARINA_NODE_HOST_ENABLED=true on the gateway and restart it.');
      process.exit(1);
    }
    const data = await res.json() as {
      pendingId: string;
      code: string;
      expiresAt: string;
      qr?: string;
    };
    console.log(chalk.bold('\nNode pairing requested\n'));
    console.log(`  pending id: ${data.pendingId}`);
    console.log(`  code: ${data.code}`);
    console.log(`  expires: ${data.expiresAt}`);
    const qr = buildNodePairQrPayload({
      gatewayUrl: base,
      pendingId: data.pendingId,
      code: data.code,
      name: os.hostname(),
    });
    console.log('');
    console.log(formatPairingQrTerminal(qr));
    console.log(chalk.gray('\nOn the gateway operator machine:'));
    console.log(chalk.gray(`  carina pairing approve ${data.pendingId}`));
    console.log(chalk.gray(`  carina node-host pair-wait ${data.pendingId} ${data.code}`));
    return;
  }

  if (action === 'pair-wait') {
    const pendingId = rest[0];
    const code = rest[1];
    const gatewayUrl = process.env.CARINA_GATEWAY_URL ?? rest[2];
    if (!pendingId || !code || !gatewayUrl) {
      console.error('Usage: carina node-host pair-wait <pending-id> <code> [gateway-url]');
      process.exit(1);
    }
    const base = gatewayUrl.replace(/\/$/, '');
    for (let i = 0; i < 120; i++) {
      const res = await postJson(`${base}/api/nodes/pair/claim`, { pendingId, code });
      const data = await res.json() as {
        status?: string;
        token?: string;
        nodeId?: string;
        name?: string;
        error?: string;
      };
      if (data.status === 'pending') {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (data.ok && data.token && data.nodeId) {
        saveLocalNodeConfig({
          gatewayUrl: base,
          nodeId: data.nodeId,
          token: data.token,
          name: data.name ?? os.hostname(),
        });
        console.log(chalk.green(`Paired and saved to ${nodeHostConfigPath()}`));
        return;
      }
      console.error(data.error ?? `Claim failed (${res.status})`);
      process.exit(1);
    }
    console.error('Timed out waiting for operator approval.');
    process.exit(1);
  }

  if (action === 'configure') {
    const gatewayUrl = rest[0];
    const nodeId = rest[1];
    const token = rest[2];
    const name = rest[3] ?? os.hostname();
    if (!gatewayUrl || !nodeId || !token) {
      console.error('Usage: carina node-host configure <gateway-url> <node-id> <token> [name]');
      process.exit(1);
    }
    saveLocalNodeConfig({ gatewayUrl, nodeId, token, name });
    console.log(chalk.green(`Saved ${nodeHostConfigPath()}`));
    return;
  }

  if (action === 'restart') {
    if (await trySystemd('restart')) return;
    clearNodeHostPid();
    console.log('No systemd unit. Restart foreground daemon:');
    console.log('  carina node-host start --foreground');
    return;
  }

  if (action === 'start') {
    if (rest.includes('--foreground') || rest[0] === '--foreground') {
      const config = loadLocalNodeConfig();
      if (!config) {
        console.error('Node not configured. Pair first or run node-host configure.');
        process.exit(1);
      }
      writeNodeHostPid();
      console.log(chalk.gray(`Node host connected to ${config.gatewayUrl} (Ctrl+C to stop)`));
      const controller = new AbortController();
      process.on('SIGINT', () => controller.abort());
      process.on('SIGTERM', () => controller.abort());
      try {
        await runNodeDaemon({ config, signal: controller.signal });
      } finally {
        clearNodeHostPid();
      }
      return;
    }
    if (await trySystemd('start')) {
      console.log(chalk.green('Node host started via systemd'));
      return;
    }
    console.log('Install a service unit first: carina node-host install');
    console.log('Or run foreground: carina node-host start --foreground');
    return;
  }

  if (action === 'stop') {
    if (await trySystemd('stop')) {
      clearNodeHostPid();
      return;
    }
    clearNodeHostPid();
    console.log('PID file cleared.');
    return;
  }

  if (action === 'install') {
    const execStart = rest[0] ?? 'carina node-host start --foreground';
    const unitPath = await installNodeHostSystemdUnit(execStart);
    console.log(chalk.green(`Wrote systemd user unit: ${unitPath}`));
    console.log('Enable and start:');
    console.log('  systemctl --user daemon-reload');
    console.log('  systemctl --user enable --now carina-node-host.service');
    return;
  }

  if (action === 'uninstall') {
    const removed = await uninstallNodeHostSystemdUnit();
    clearNodeHostPid();
    removeLocalNodeConfig();
    console.log(removed ? chalk.green('Removed node-host systemd unit and local config') : 'Nothing to uninstall');
    return;
  }

  console.error(
    'Usage: carina node-host <status|pair|pair-wait|configure|start|stop|restart|install|uninstall|audit> [args]',
  );
  process.exit(1);
}
