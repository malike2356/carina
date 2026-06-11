import chalk from 'chalk';
import {
  createBackup,
  createSandboxContainer,
  execInSandboxContainer,
  getDebugProxyState,
  listBackups,
  listSandboxContainers,
  lookupHostname,
  pruneSandboxContainers,
  reloadSecrets,
  restoreBackup,
  runSecurityAudit,
  sandboxStatus,
  startDebugProxy,
  stopDebugProxy,
  stopSandboxContainer,
  tailscaleStatus,
  verifyBackup,
  resolveTailscaleHost,
} from '../../ops/index.js';
import { loadLocalEnv } from '../config/env.js';
import { runTurnsOps } from './ops-turns.js';

export async function runOpsCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const group = args[0];
  const sub = args[1];
  const rest = args.slice(2);

  if (!group || group === 'help') {
    printOpsUsage();
    return;
  }

  if (group === 'sandbox') {
    await runSandboxOps(sub ?? 'status', rest);
    return;
  }

  if (group === 'dns') {
    await runDnsOps(sub ?? 'lookup', rest);
    return;
  }

  if (group === 'proxy') {
    await runProxyOps(sub ?? 'status', rest);
    return;
  }

  if (group === 'backup') {
    await runBackupOps(sub ?? 'list', rest);
    return;
  }

  if (group === 'secrets') {
    if ((sub ?? 'reload') !== 'reload') {
      console.error('Usage: carina ops secrets reload [--notify]');
      process.exit(1);
    }
    const result = await reloadSecrets({ notifyGateway: rest.includes('--notify') });
    console.log(chalk.green(`Reloaded ${result.reloaded.length} env key(s)`));
    if (result.skipped.length > 0) {
      console.log(chalk.gray(`Skipped ${result.skipped.length} (already set)`));
    }
    if (rest.includes('--notify')) {
      console.log(result.gatewayNotified
        ? chalk.green('Gateway notified')
        : chalk.yellow('Gateway not reachable (start carina web)'));
    }
    return;
  }

  if (group === 'turns') {
    await runTurnsOps(rest);
    return;
  }

  if (group === 'audit') {
    const report = await runSecurityAudit();
    if (rest.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(chalk.bold('\nSecurity audit\n'));
    for (const c of report.checks) {
      const icon = c.severity === 'ok'
        ? chalk.green('ok')
        : c.severity === 'fail'
          ? chalk.red('FAIL')
          : chalk.yellow('warn');
      console.log(`  ${icon}  ${c.name}: ${c.detail}`);
    }
    console.log(
      chalk.gray(
        `\n${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail\n`,
      ),
    );
    if (report.summary.fail > 0) process.exit(1);
    return;
  }

  console.error(`Unknown ops group: ${group}`);
  printOpsUsage();
  process.exit(1);
}

function printOpsUsage(): void {
  console.log(`
carina ops - runtime operations

  carina ops sandbox <status|list|create|exec|stop|prune> [args]
  carina ops dns <lookup|tailscale|resolve> [host]
  carina ops proxy <status|start|stop> [--port N] [--target URL]
  carina ops backup <list|create|restore|verify> [label]
  carina ops secrets reload [--notify]
  carina ops audit [--json]
  carina ops turns [--since 24h] [--bucket slow] [--limit N] [--json]
`);
}

async function runSandboxOps(action: string, args: string[]): Promise<void> {
  if (action === 'status') {
    const s = await sandboxStatus();
    console.log(`docker: ${s.docker ? 'yes' : 'no'}`);
    console.log(`containers: ${s.running}/${s.total} running`);
    console.log(`image: ${s.image}`);
    return;
  }
  if (action === 'list') {
    const rows = await listSandboxContainers();
    if (rows.length === 0) {
      console.log('No sandbox containers.');
      return;
    }
    for (const row of rows) {
      console.log(`  ${row.name.padEnd(28)} ${row.status.padEnd(20)} ${row.image}`);
    }
    return;
  }
  if (action === 'create') {
    const label = args[0] ?? `agent-${Date.now()}`;
    const result = await createSandboxContainer(label);
    console.log(result.created ? chalk.green(result.message) : chalk.yellow(result.message));
    return;
  }
  if (action === 'exec') {
    const label = args[0];
    const command = args.slice(1).join(' ');
    if (!label || !command) {
      console.error('Usage: carina ops sandbox exec <label> <command>');
      process.exit(1);
    }
    const result = await execInSandboxContainer(label, command);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return;
  }
  if (action === 'stop') {
    const label = args[0];
    if (!label) {
      console.error('Usage: carina ops sandbox stop <label>');
      process.exit(1);
    }
    const ok = await stopSandboxContainer(label);
    console.log(ok ? chalk.green(`Stopped ${label}`) : chalk.red(`Failed to stop ${label}`));
    return;
  }
  if (action === 'prune') {
    const n = await pruneSandboxContainers();
    console.log(chalk.green(`Removed ${n} sandbox container(s)`));
    return;
  }
  console.error('Usage: carina ops sandbox <status|list|create|exec|stop|prune>');
  process.exit(1);
}

async function runDnsOps(action: string, args: string[]): Promise<void> {
  if (action === 'tailscale') {
    const status = await tailscaleStatus();
    if (!status.available) {
      console.error(status.error ?? 'Tailscale not available');
      process.exit(1);
    }
    if (status.self) {
      console.log(`self: ${status.self.dnsName || status.self.hostname} ${status.self.ips.join(', ')}`);
    }
    if (status.magicDnsSuffix) {
      console.log(`magicdns: *.${status.magicDnsSuffix}`);
    }
    for (const peer of status.peers) {
      const mark = peer.online ? chalk.green('online') : chalk.gray('offline');
      console.log(`  ${peer.dnsName || peer.hostname}  ${peer.ips.join(', ')}  ${mark}`);
    }
    return;
  }
  const host = args[0];
  if (!host) {
    console.error('Usage: carina ops dns <lookup|resolve> <hostname>');
    process.exit(1);
  }
  const result = action === 'resolve'
    ? await resolveTailscaleHost(host)
    : await lookupHostname(host);
  if (result.error && result.addresses.length === 0) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(`${result.hostname}:`);
  for (const addr of result.addresses) console.log(`  ${addr}`);
  if (result.cname?.length) console.log(`  cname: ${result.cname.join(', ')}`);
  if (result.txt?.length) console.log(`  txt: ${result.txt.join(' | ')}`);
}

async function runProxyOps(action: string, args: string[]): Promise<void> {
  const portArg = args.find((a) => a.startsWith('--port='))?.slice('--port='.length)
    ?? (args.includes('--port') ? args[args.indexOf('--port') + 1] : undefined);
  const targetArg = args.find((a) => a.startsWith('--target='))?.slice('--target='.length)
    ?? (args.includes('--target') ? args[args.indexOf('--target') + 1] : undefined);

  if (action === 'status') {
    const state = getDebugProxyState();
    if (!state.running) {
      console.log('Debug proxy: not running');
      return;
    }
    console.log(`Debug proxy: running pid=${state.pid ?? '-'} port=${state.port ?? '-'}`);
    if (state.target) console.log(`  target: ${state.target}`);
    if (state.logFile) console.log(`  log: ${state.logFile}`);
    return;
  }
  if (action === 'start') {
    const target = targetArg ?? `http://127.0.0.1:${process.env.WEB_PORT ?? '3000'}`;
    const state = await startDebugProxy({
      port: portArg ? Number(portArg) : undefined,
      target,
    });
    console.log(chalk.green(`Debug proxy listening on 127.0.0.1:${state.port} -> ${state.target}`));
    console.log(chalk.gray(`Log: ${state.logFile}`));
    return;
  }
  if (action === 'stop') {
    await stopDebugProxy();
    console.log(chalk.green('Debug proxy stopped'));
    return;
  }
  console.error('Usage: carina ops proxy <status|start|stop> [--port N] [--target URL]');
  process.exit(1);
}

async function runBackupOps(action: string, args: string[]): Promise<void> {
  if (action === 'list') {
    const labels = await listBackups();
    if (labels.length === 0) {
      console.log('No backups.');
      return;
    }
    for (const label of labels) console.log(`  ${label}`);
    return;
  }
  if (action === 'create') {
    const label = args[0];
    const result = await createBackup(label ? { label } : {});
    console.log(chalk.green(`Backup created: ${result.path}`));
    console.log(chalk.gray(`  items: ${result.manifest.items.join(', ')}`));
    console.log(chalk.gray(`  files: ${result.manifest.files.length}`));
    return;
  }
  if (action === 'restore') {
    const label = args[0];
    if (!label) {
      console.error('Usage: carina ops backup restore <label>');
      process.exit(1);
    }
    const result = await restoreBackup(label);
    console.log(chalk.green(`Restored backup ${result.label}: ${result.restored.join(', ')}`));
    return;
  }
  if (action === 'verify') {
    const label = args[0];
    if (!label) {
      console.error('Usage: carina ops backup verify <label>');
      process.exit(1);
    }
    const result = await verifyBackup(label);
    if (result.ok) {
      console.log(chalk.green(`Backup ${label} verified`));
      return;
    }
    console.log(chalk.red(`Backup ${label} failed verification:`));
    for (const err of result.errors) console.log(`  - ${err}`);
    process.exit(1);
  }
  console.error('Usage: carina ops backup <list|create|restore|verify> [label]');
  process.exit(1);
}
