import chalk from 'chalk';
import fs from 'fs';
import {
  clearHostPidFile,
  getHostServiceStatus,
  installSystemdUserUnit,
  systemdUnitTemplate,
  systemdUserUnitPath,
  writeHostPidFile,
} from '../../infrastructure/host-service.js';
import { loadLocalEnv } from '../config/env.js';

export async function runHostCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';

  if (action === 'status') {
    const status = await getHostServiceStatus();
    console.log(chalk.bold('\nCarina host service\n'));
    console.log(`  running: ${status.running ? chalk.green('yes') : chalk.yellow('no')}`);
    console.log(`  pid: ${status.pid ?? '-'}`);
    console.log(`  uptime: ${status.uptimeSeconds}s`);
    console.log(`  hostname: ${status.hostname}`);
    console.log(`  web port: ${status.webPort}`);
    console.log(`  memory: ${status.memoryBackend}`);
    console.log(`  scout: ${status.scoutEnabled ? 'on' : 'off'}`);
    console.log(`  agents: ${status.agents}`);
    console.log(`  paired devices: ${status.pairedDevices}`);
    console.log(`  cron jobs: ${status.cronJobs ?? 'n/a'}`);
    const enabled = status.channels.filter((c) => c.enabled).map((c) => c.name);
    console.log(`  channels: ${enabled.length ? enabled.join(', ') : 'none'}`);
    console.log('');
    return;
  }

  if (action === 'systemd') {
    console.log(systemdUnitTemplate(args[1] ?? 'carina web'));
    return;
  }

  if (action === 'install') {
    const execStart = args[1] ?? 'carina web';
    const unitPath = await installSystemdUserUnit(execStart);
    console.log(chalk.green(`Wrote systemd user unit: ${unitPath}`));
    console.log('Enable and start:');
    console.log('  systemctl --user daemon-reload');
    console.log('  systemctl --user enable --now carina-gateway.service');
    return;
  }

  if (action === 'uninstall') {
    const unitPath = systemdUserUnitPath();
    if (fs.existsSync(unitPath)) {
      fs.unlinkSync(unitPath);
      console.log(chalk.green(`Removed ${unitPath}`));
    } else {
      console.log('No systemd user unit installed.');
    }
    clearHostPidFile();
    return;
  }

  if (action === 'pid') {
    writeHostPidFile();
    console.log(`PID file updated: ${process.pid}`);
    return;
  }

  console.error('Usage: carina host <status|install|uninstall|systemd|pid> [exec]');
  process.exit(1);
}
