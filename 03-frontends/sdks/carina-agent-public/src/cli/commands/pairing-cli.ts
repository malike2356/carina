import chalk from 'chalk';
import {
  createPairingCode,
  getPendingPairing,
  listPairedDevices,
  redactDevicesForApi,
  revokePairedDevice,
} from '../../infrastructure/device-pairing.js';

export async function runPairingCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'status';

  if (action === 'status') {
    const pending = getPendingPairing();
    const devices = listPairedDevices();
    console.log(chalk.bold('\nDevice pairing\n'));
    if (pending) {
      console.log(`  pending code: ${pending.code} (expires ${pending.expiresAt})`);
    } else {
      console.log('  pending code: none');
    }
    console.log(`  paired devices: ${devices.length}`);
    for (const d of redactDevicesForApi(devices)) {
      console.log(`    ${d.id.slice(0, 8)}  ${d.name}  ${d.platform}  last seen ${d.lastSeenAt}`);
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

  if (action === 'revoke') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina pairing revoke <device-id>');
      process.exit(1);
    }
    const ok = revokePairedDevice(id);
    console.log(ok ? chalk.green(`Revoked ${id}`) : chalk.red('Device not found'));
    return;
  }

  console.error('Usage: carina pairing <status|code|devices|revoke> [id]');
  process.exit(1);
}
