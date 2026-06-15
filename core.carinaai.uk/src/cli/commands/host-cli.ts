import chalk from 'chalk';
import {
  appendDaemonLog,
  followDaemonLog,
  getDaemonStatus,
  installHostService,
  readDaemonLogTail,
  restartHostService,
  runGatewaySupervisor,
  startHostService,
  stopHostService,
  uninstallHostService,
  defaultGatewayCommand,
  detectServiceManager,
  systemdUnitTemplate,
  launchdPlistTemplate,
  launchdPlistPath,
  systemdUserUnitPath,
} from '../../host/daemon.js';
import { getHostServiceStatus } from '../../infrastructure/host-service.js';
import { loadLocalEnv } from '../config/env.js';

export async function runHostCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';

  if (action === 'status') {
    const daemon = getDaemonStatus();
    const status = await getHostServiceStatus();
    console.log(chalk.bold('\nCarina host service\n'));
    console.log(`  running: ${daemon.running ? chalk.green('yes') : chalk.yellow('no')}`);
    console.log(`  pid: ${daemon.pid ?? '-'}`);
    console.log(`  uptime: ${daemon.uptimeSeconds}s`);
    console.log(`  url: ${daemon.url}`);
    console.log(`  service manager: ${daemon.serviceManager}`);
    if (daemon.lastError) console.log(`  last error: ${daemon.lastError}`);
    console.log(`  hostname: ${status.hostname}`);
    console.log(`  memory: ${status.memoryBackend}`);
    console.log(`  scout: ${status.scoutEnabled ? 'on' : 'off'}`);
    console.log(`  agents: ${status.agents}`);
    console.log(`  paired devices: ${status.pairedDevices}`);
    const enabled = status.channels.filter((c) => c.enabled).map((c) => c.name);
    console.log(`  channels: ${enabled.length ? enabled.join(', ') : 'none'}`);
    console.log('');
    return;
  }

  if (action === 'install') {
    const execStart = args[1] ?? defaultGatewayCommand();
    const installed = await installHostService(execStart);
    const manager = installed.manager;
    console.log(chalk.green('Installed. Run `carina host start` to start.'));
    if (manager === 'systemd') {
      console.log(`  unit: ${installed.path ?? systemdUserUnitPath()}`);
      console.log('  systemctl --user daemon-reload');
      console.log('  systemctl --user enable --now carina-gateway.service');
    } else if (manager === 'launchd') {
      console.log(`  plist: ${installed.path ?? launchdPlistPath()}`);
      console.log('  launchctl load ~/Library/LaunchAgents/com.carina.gateway.plist');
    } else if (manager === 'schtasks') {
      console.log(`  task: ${installed.path ?? 'schtasks:CarinaGateway'}`);
      console.log('  Starts on user logon. Manual run: schtasks /Run /TN CarinaGateway');
    } else {
      console.log('  No service manager found. Use `carina host start` to run the supervisor.');
    }
    return;
  }

  if (action === 'start') {
    const execStart = args[1] ?? defaultGatewayCommand();
    const started = await startHostService(execStart);
    console.log(chalk.green(`Host started. PID ${started.pid}`));
    console.log(`URL: ${started.url}`);
    return;
  }

  if (action === 'stop') {
    const ok = await stopHostService(5000);
    console.log(ok ? chalk.green('Host stopped.') : chalk.yellow('Stop timed out; PID cleared.'));
    return;
  }

  if (action === 'restart') {
    const execStart = args[1] ?? defaultGatewayCommand();
    const started = await restartHostService(execStart);
    console.log(chalk.green(`Host restarted. PID ${started.pid}`));
    console.log(`URL: ${started.url}`);
    return;
  }

  if (action === 'uninstall') {
    await uninstallHostService();
    console.log(chalk.green('Host service removed. Data left intact.'));
    return;
  }

  if (action === 'logs') {
    const follow = args.includes('--follow');
    const lines = readDaemonLogTail(80);
    if (lines.length === 0) {
      console.log('No daemon log entries yet.');
    } else {
      for (const line of lines) console.log(line);
    }
    if (follow) {
      console.log(chalk.gray('Following daemon.log (Ctrl+C to stop)...'));
      const watcher = followDaemonLog((line) => console.log(line));
      await new Promise<void>((resolve) => {
        process.on('SIGINT', () => {
          watcher.close();
          resolve();
        });
      });
    }
    return;
  }

  if (action === 'supervise') {
    const execStart = process.env.CARINA_HOST_EXEC_START ?? args[1] ?? defaultGatewayCommand();
    const controller = new AbortController();
    process.on('SIGINT', () => controller.abort());
    process.on('SIGTERM', () => controller.abort());
    appendDaemonLog('Foreground supervisor starting');
    await runGatewaySupervisor({ execStart, signal: controller.signal });
    return;
  }

  if (action === 'systemd') {
    console.log(systemdUnitTemplate(args[1] ?? defaultGatewayCommand()));
    return;
  }

  if (action === 'launchd') {
    console.log(launchdPlistTemplate(args[1] ?? defaultGatewayCommand()));
    return;
  }

  if (action === 'manager') {
    console.log(detectServiceManager());
    return;
  }

  console.error('Usage: carina host <status|install|start|stop|restart|uninstall|logs|supervise> [args]');
  console.error('       carina host logs --follow');
  process.exit(1);
}
