import chalk from 'chalk';
import {
  createPairingCode,
  getPendingPairing,
  listPairedDevices,
  redactDevicesForApi,
  revokePairedDevice,
  rotateDeviceToken,
} from '../../infrastructure/device-pairing.js';
import {
  approvePendingPairing,
  getPendingPairing as getNodePending,
  listPairedNodes,
  listPendingPairings,
  redactNodesForApi,
  removePendingPairing,
  revokePairedNode,
  rotateNodeToken,
} from '../../infrastructure/node-host/store.js';
import { buildNodePairQrPayload, formatPairingQrTerminal } from '../../infrastructure/node-host/qr.js';
import { appendNodeAudit } from '../../infrastructure/node-host/audit.js';

export async function runPairingCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'status';

  if (action === 'status') {
    const pending = getPendingPairing();
    const devices = listPairedDevices();
    const nodePending = listPendingPairings();
    const nodes = listPairedNodes();
    console.log(chalk.bold('\nPairing status\n'));
    console.log(chalk.bold('  Mobile devices'));
    if (pending) {
      console.log(`    pending code: ${pending.code} (expires ${pending.expiresAt})`);
    } else {
      console.log('    pending code: none');
    }
    console.log(`    paired: ${devices.length}`);
    console.log(chalk.bold('  Remote nodes'));
    console.log(`    pending: ${nodePending.length}`);
    console.log(`    paired: ${nodes.length}`);
    for (const n of redactNodesForApi(nodes)) {
      console.log(`      ${n.id.slice(0, 8)}  ${n.name}  ${n.hostname}  ${n.status}`);
    }
    console.log('');
    return;
  }

  if (action === 'code') {
    const pending = createPairingCode();
    console.log(`Pairing code: ${pending.code}`);
    console.log(`Expires: ${pending.expiresAt}`);
    console.log('Claim from mobile: POST /api/pairing/claim { code, name, platform }');
    return;
  }

  if (action === 'devices' || action === 'list') {
    const devices = redactDevicesForApi(listPairedDevices());
    if (devices.length === 0) {
      console.log('No paired devices.');
      return;
    }
    for (const d of devices) {
      console.log(`${d.id}  ${d.name}  ${d.platform}`);
    }
    return;
  }

  if (action === 'nodes') {
    const nodes = redactNodesForApi(listPairedNodes());
    const pending = listPendingPairings();
    if (pending.length) {
      console.log(chalk.bold('Pending node pairings:'));
      for (const p of pending) {
        console.log(`  ${p.id}  ${p.name}  ${p.hostname}  code=${p.code}  expires ${p.expiresAt}`);
      }
    }
    if (nodes.length === 0 && pending.length === 0) {
      console.log('No remote nodes.');
      return;
    }
    for (const n of nodes) {
      console.log(`${n.id}  ${n.name}  ${n.hostname}  ${n.status}`);
    }
    return;
  }

  if (action === 'approve') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina pairing approve <pending-node-id>');
      process.exit(1);
    }
    const pending = getNodePending(id);
    if (!pending) {
      console.error('Pending node pairing not found.');
      process.exit(1);
    }
    const node = approvePendingPairing(id);
    appendNodeAudit({ action: 'pair.approve', nodeId: id, detail: pending.name, actor: 'cli' });
    console.log(chalk.green(`Approved node ${node?.name} (${id})`));
    console.log('Remote machine: carina node-host pair-wait ' + id + ' ' + pending.code);
    return;
  }

  if (action === 'reject') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina pairing reject <pending-node-id>');
      process.exit(1);
    }
    const ok = removePendingPairing(id);
    if (ok) appendNodeAudit({ action: 'pair.reject', nodeId: id, actor: 'cli' });
    console.log(ok ? chalk.yellow(`Rejected ${id}`) : chalk.red('Not found'));
    return;
  }

  if (action === 'qr') {
    const id = args[1];
    const gatewayUrl = args[2] ?? process.env.CARINA_GATEWAY_URL ?? 'http://127.0.0.1:3000';
    if (!id) {
      console.error('Usage: carina pairing qr <pending-node-id> [gateway-url]');
      process.exit(1);
    }
    const pending = getNodePending(id);
    if (!pending) {
      console.error('Pending node pairing not found.');
      process.exit(1);
    }
    const qr = buildNodePairQrPayload({
      gatewayUrl,
      pendingId: pending.id,
      code: pending.code,
      name: pending.name,
    });
    console.log(formatPairingQrTerminal(qr));
    return;
  }

  if (action === 'revoke') {
    const id = args[1];
    const kind = args[2];
    if (!id) {
      console.error('Usage: carina pairing revoke <id> [device|node]');
      process.exit(1);
    }
    if (kind === 'node' || id.length > 20) {
      const ok = revokePairedNode(id);
      if (ok) appendNodeAudit({ action: 'node.revoke', nodeId: id, actor: 'cli' });
      console.log(ok ? chalk.green(`Revoked node ${id}`) : chalk.red('Node not found'));
      return;
    }
    const ok = revokePairedDevice(id);
    console.log(ok ? chalk.green(`Revoked device ${id}`) : chalk.red('Device not found'));
    return;
  }

  if (action === 'rotate') {
    const id = args[1];
    const kind = args[2];
    if (!id) {
      console.error('Usage: carina pairing rotate <id> [device|node]');
      process.exit(1);
    }
    if (kind === 'node') {
      const rotated = rotateNodeToken(id);
      if (!rotated) {
        console.error('Node not found');
        process.exit(1);
      }
      appendNodeAudit({ action: 'node.rotate', nodeId: id, actor: 'cli' });
      console.log(chalk.green(`New node token: ${rotated.token}`));
      return;
    }
    const rotated = rotateDeviceToken(id);
    if (!rotated) {
      console.error('Device not found');
      process.exit(1);
    }
    console.log(chalk.green(`New device token: ${rotated.token}`));
    return;
  }

  console.error('Usage: carina pairing <status|code|devices|nodes|approve|reject|revoke|rotate|qr> [args]');
  process.exit(1);
}
