import chalk from 'chalk';
import {
  acceptPairingToken,
  createPairingToken,
  listPairDevicesForApi,
  renderTerminalQr,
  revokePairDevice,
  waitForPairingByToken,
} from '../../pairing/pairing.js';
import {
  listPairedDevices,
  revokePairedDevice,
} from '../../infrastructure/device-pairing.js';

export async function runPairCommand(args: string[]): Promise<void> {
  const action = args[0];

  if (!action) {
    const session = createPairingToken();
    const { getLocalLanIp } = await import('../../pairing/pairing.js');
    console.log(chalk.bold('\nDevice pairing\n'));
    console.log(`Token expires: ${session.expiresAt}`);
    console.log(`LAN host: ${getLocalLanIp()}`);
    console.log(`URI: ${session.uri}`);
    console.log('');
    console.log(renderTerminalQr(session.uri));
    console.log('');
    console.log(chalk.gray('Waiting for a device to pair (5 minutes)...'));
    console.log(chalk.gray(`Mobile companion: open /mobile on this gateway (or scan URI below)`));

    const result = await waitForPairingByToken(session.token);
    if (!result) {
      console.log(chalk.yellow('Pairing timed out or was not completed.'));
      process.exit(1);
    }
    console.log(chalk.green(`Paired device ${result.deviceId}`));
    return;
  }

  if (action === 'list') {
    const devices = listPairDevicesForApi();
    if (devices.length === 0) {
      console.log('No paired devices.');
      return;
    }
    for (const device of devices) {
      console.log(`${device.id}  ${device.name}  last seen ${device.lastSeen}`);
    }
    return;
  }

  if (action === 'revoke') {
    const id = args[1];
    if (!id) {
      console.error('Usage: carina pair revoke <id>');
      process.exit(1);
    }
    const ok = revokePairDevice(id) || revokePairedDevice(id);
    console.log(ok ? chalk.green(`Revoked ${id}`) : chalk.red('Device not found'));
    return;
  }

  if (action === 'token') {
    const session = createPairingToken();
    const { getLocalLanIp } = await import('../../pairing/pairing.js');
    console.log(chalk.bold('\nPairing token (scan or paste on mobile)\n'));
    console.log(`Expires: ${session.expiresAt}`);
    console.log(`LAN host: ${getLocalLanIp()}`);
    console.log(`Token: ${session.token}`);
    console.log(`URI: ${session.uri}`);
    console.log('');
    console.log(renderTerminalQr(session.uri));
    return;
  }

  if (action === 'presence') {
    const { collectPresence } = await import('../../ops/observability/system-events.js');
    const presence = collectPresence().filter((p) => p.kind === 'device');
    if (presence.length === 0) {
      console.log('No paired mobile devices.');
      return;
    }
    for (const entry of presence) {
      const status = entry.online ? chalk.green('online') : chalk.gray('offline');
      console.log(`${entry.label}  ${status}  last seen ${entry.lastSeenAt}`);
    }
    return;
  }

  if (action === 'accept') {
    const token = args[1];
    const name = args[2] ?? 'Paired device';
    if (!token) {
      console.error('Usage: carina pair accept <token> [device-name]');
      process.exit(1);
    }
    const result = acceptPairingToken(token, name);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error('Usage: carina pair [list|revoke|token|accept|presence] [args]');
  process.exit(1);
}

export async function runPairStatus(): Promise<void> {
  const devices = listPairedDevices();
  console.log(chalk.bold(`\nPaired devices: ${devices.length}\n`));
  for (const device of devices) {
    console.log(`  ${device.id}  ${device.name}  ${device.platform}`);
  }
  console.log('');
}
