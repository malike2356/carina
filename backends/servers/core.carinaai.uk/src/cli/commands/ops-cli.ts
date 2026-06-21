import chalk from 'chalk';
import {
  createBackup,
  createSandboxContainer,
  execInSandboxContainer,
  exportBackupArchive,
  getDebugProxyState,
  listBackups,
  listSandboxContainers,
  lookupHostname,
  planRestore,
  pruneSandboxContainers,
  reloadSecrets,
  restoreBackupWithOptions,
  runSecurityAudit,
  sandboxStatus,
  startDebugProxy,
  stopDebugProxy,
  stopSandboxContainer,
  tailscaleStatus,
  verifyBackup,
  resolveTailscaleHost,
} from '../../ops/index.js';
import {
  debugCaptureEnabled,
  debugProxyProviderFilter,
  getDebugCapture,
  listDebugCaptures,
  listProxiedProviders,
  purgeDebugCaptures,
} from '../../ops/debug-proxy-capture.js';
import {
  describeSessionSandbox,
  destroySessionSandbox,
  explainSessionSandbox,
  recreateSessionSandbox,
} from '../../infrastructure/sandbox-session.js';
import { buildControlStatus, formatControlStatus } from '../../ops/control-status.js';
import {
  buildExtensibilityStatus,
  formatExtensibilityStatus,
} from '../../ops/extensibility-status.js';
import { getHostServiceStatus } from '../../infrastructure/host-service.js';
import path from 'path';
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

  if (group === 'set-password') {
    const { setWebPassword, getWebPasswordStatus } = await import('../../ops/web-password.js');
    const password = sub ?? '';
    const confirm = rest[0] ?? password;
    if (!password) {
      const status = getWebPasswordStatus();
      console.log(status.set ? chalk.green('CARINA_WEB_PASSWORD is set') : chalk.yellow('CARINA_WEB_PASSWORD is not set'));
      console.error('Usage: carina ops set-password <password> [confirm]');
      process.exit(status.set ? 0 : 1);
    }
    try {
      const result = await setWebPassword(password, confirm, 'cli');
      console.log(chalk.green(`Web password updated at ${result.updatedAt}`));
      console.log(chalk.gray('Restart the web gateway or run: carina ops secrets reload --notify'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(msg));
      process.exit(1);
    }
    return;
  }

  if (group === 'turns') {
    await runTurnsOps(rest);
    return;
  }

  if (group === 'extensibility') {
    const report = await buildExtensibilityStatus();
    if (rest.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(formatExtensibilityStatus(report));
    return;
  }

  if (group === 'control') {
    await runControlOps(sub ?? 'status', rest);
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

  carina ops sandbox <status|list|create|recreate|exec|stop|teardown|prune|explain|session> [args]
  carina ops control <status|push|pull|file-policy> [args]
  carina ops extensibility [--json]
  carina ops dns <lookup|tailscale|resolve> [host]
  carina ops proxy <status|start|stop|providers|captures> [--port N] [--target URL]
  carina ops backup <list|create|archive|plan|restore|verify> [label] [--force] [--dry-run] [--json]
  carina ops secrets reload [--notify]
  carina ops set-password <password> [confirm]
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
  if (action === 'recreate') {
    const label = args[0];
    if (!label) {
      console.error('Usage: carina ops sandbox recreate <label>');
      process.exit(1);
    }
    await stopSandboxContainer(label);
    const result = await createSandboxContainer(label);
    console.log(result.created ? chalk.green(`Recreated ${label}`) : chalk.yellow(result.message));
    return;
  }
  if (action === 'teardown') {
    const label = args[0];
    if (label) {
      const ok = await stopSandboxContainer(label);
      console.log(ok ? chalk.green(`Teardown ${label}`) : chalk.red(`Failed ${label}`));
      return;
    }
    const n = await pruneSandboxContainers();
    console.log(chalk.green(`Teardown complete (${n} container(s) removed)`));
    return;
  }
  if (action === 'explain') {
    const sessionId = args[0] ?? 'default-session';
    const profile = args.includes('--profile')
      ? args[args.indexOf('--profile') + 1]
      : undefined;
    const state = await describeSessionSandbox(sessionId, profile);
    console.log(explainSessionSandbox(state));
    return;
  }
  if (action === 'session') {
    const sub = args[0];
    const sessionId = args[1] ?? 'default-session';
    const profile = args.includes('--profile')
      ? args[args.indexOf('--profile') + 1]
      : undefined;
    if (sub === 'describe' || sub === 'explain') {
      const state = await describeSessionSandbox(sessionId, profile);
      console.log(explainSessionSandbox(state));
      return;
    }
    if (sub === 'recreate') {
      const state = await recreateSessionSandbox(sessionId, profile);
      console.log(chalk.green(explainSessionSandbox(state)));
      return;
    }
    if (sub === 'destroy' || sub === 'teardown') {
      const ok = await destroySessionSandbox(sessionId, profile);
      console.log(ok ? chalk.green('Session sandbox destroyed') : chalk.red('Destroy failed'));
      return;
    }
    console.error('Usage: carina ops sandbox session <describe|explain|recreate|destroy|teardown> [sessionId] [--profile NAME]');
    process.exit(1);
    return;
  }
  console.error('Usage: carina ops sandbox <status|list|create|recreate|exec|stop|teardown|prune|explain|session>');
  process.exit(1);
}

async function runControlOps(action: string, args: string[]): Promise<void> {
  if (action === 'push') {
    const nodeId = args[0];
    const localPath = args[1];
    const remotePath = args[2];
    if (!nodeId || !localPath || !remotePath) {
      console.error('Usage: carina ops control push <nodeId> <localPath> <remotePath>');
      process.exit(1);
    }
    const { pushFileToNode } = await import('../../infrastructure/node-host/dispatch.js');
    await pushFileToNode(nodeId, localPath, remotePath);
    console.log(chalk.green(`Pushed ${localPath} -> ${nodeId}:${remotePath}`));
    return;
  }
  if (action === 'pull') {
    const nodeId = args[0];
    const remotePath = args[1];
    const localPath = args[2] ?? path.basename(remotePath);
    if (!nodeId || !remotePath) {
      console.error('Usage: carina ops control pull <nodeId> <remotePath> [localPath]');
      process.exit(1);
    }
    const { pullFileFromNode } = await import('../../infrastructure/node-host/dispatch.js');
    await pullFileFromNode(nodeId, remotePath, localPath);
    console.log(chalk.green(`Pulled ${nodeId}:${remotePath} -> ${localPath}`));
    return;
  }
  if (action === 'file-policy') {
    const { explainNodeFilePolicy } = await import('../../security/node-file-policy.js');
    console.log(explainNodeFilePolicy());
    return;
  }
  if (action !== 'status') {
    console.error('Usage: carina ops control <status|push|pull|file-policy> [args]');
    process.exit(1);
  }
  const host = await getHostServiceStatus();
  const report = await buildControlStatus({ hostRunning: host.running });
  if (args.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(chalk.bold('\n' + formatControlStatus(report) + '\n'));
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
    } else {
      console.log(`Debug proxy: running pid=${state.pid ?? '-'} port=${state.port ?? '-'}`);
      if (state.target) console.log(`  target: ${state.target}`);
      if (state.logFile) console.log(`  log: ${state.logFile}`);
    }
    console.log(`Capture: ${debugCaptureEnabled() ? 'on' : 'off (CARINA_DEBUG_PROXY_CAPTURE=true)'}`);
    const { debugProviderRoutingEnabled } = await import('../../brain/provider-proxy-routing.js');
    console.log(`Routing: ${debugProviderRoutingEnabled() ? 'on (CARINA_DEBUG_PROXY_ROUTING=true)' : 'off'}`);
    const filter = debugProxyProviderFilter();
    if (filter) console.log(`  provider filter: ${filter.join(', ')}`);
    const providers = listProxiedProviders();
    if (providers.length > 0) console.log(`  proxied providers: ${providers.join(', ')}`);
    return;
  }
  if (action === 'providers') {
    const filter = debugProxyProviderFilter();
    console.log(`Filter: ${filter ? filter.join(', ') : 'all (*)'}`);
    console.log(`Observed: ${listProxiedProviders().join(', ') || '(none)'}`);
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
  if (action === 'captures') {
    const sub = args[0] ?? 'list';
    if (sub === 'list') {
      for (const c of listDebugCaptures(30)) {
        console.log(`  ${c.id.slice(0, 8)}  ${c.direction}  ${c.method}  ${c.statusCode ?? '-'}  ${c.provider ?? '-'}  ${c.url.slice(0, 60)}`);
      }
      return;
    }
    if (sub === 'get') {
      const id = args[1];
      const cap = id ? getDebugCapture(id) : undefined;
      if (!cap) {
        console.error('Capture not found');
        process.exit(1);
      }
      console.log(JSON.stringify(cap, null, 2));
      return;
    }
    if (sub === 'purge') {
      const n = purgeDebugCaptures();
      console.log(chalk.green(`Purged ${n} capture(s)`));
      return;
    }
    console.error('Usage: carina ops proxy captures <list|get|purge> [id]');
    process.exit(1);
    return;
  }
  console.error('Usage: carina ops proxy <status|start|stop|captures> [--port N] [--target URL]');
  process.exit(1);
}

async function runBackupOps(action: string, args: string[]): Promise<void> {
  const json = args.includes('--json');
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const positional = args.filter((a) => !a.startsWith('--'));

  if (action === 'list') {
    const labels = await listBackups();
    if (json) {
      console.log(JSON.stringify({ backups: labels }, null, 2));
      return;
    }
    if (labels.length === 0) {
      console.log('No backups.');
      return;
    }
    for (const label of labels) console.log(`  ${label}`);
    return;
  }

  if (action === 'create') {
    const label = positional[0];
    const result = await createBackup(label ? { label } : {});
    if (json) {
      console.log(JSON.stringify({
        label: result.label,
        path: result.path,
        manifest: result.manifest,
      }, null, 2));
      return;
    }
    console.log(chalk.green(`Backup created: ${result.path}`));
    console.log(chalk.gray(`  items: ${result.manifest.items.join(', ')}`));
    console.log(chalk.gray(`  files: ${result.manifest.files.length}`));
    return;
  }

  if (action === 'archive') {
    const label = positional[0];
    if (!label) {
      console.error('Usage: carina ops backup archive <label>');
      process.exit(1);
    }
    const { archivePath } = await exportBackupArchive(label);
    console.log(chalk.green(`Archive: ${archivePath}`));
    return;
  }

  if (action === 'plan') {
    const label = positional[0];
    if (!label) {
      console.error('Usage: carina ops backup plan <label>');
      process.exit(1);
    }
    const plan = await planRestore(label);
    if (json) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
    console.log(`Restore plan: ${plan.label}`);
    console.log(`  items: ${plan.items.join(', ') || '(none)'}`);
    console.log(`  will overwrite: ${plan.willOverwrite.join(', ') || '(none)'}`);
    for (const w of plan.warnings) console.log(chalk.yellow(`  warning: ${w}`));
    return;
  }

  if (action === 'restore') {
    const label = positional[0];
    if (!label) {
      console.error('Usage: carina ops backup restore <label> [--force] [--dry-run]');
      process.exit(1);
    }
    try {
      const result = await restoreBackupWithOptions(label, { force, dryRun });
      if (dryRun) {
        console.log(chalk.cyan('Dry run; no files changed.'));
        for (const w of result.plan.warnings) console.log(chalk.yellow(`  ${w}`));
        console.log(`Would restore: ${result.plan.items.join(', ')}`);
        return;
      }
      console.log(chalk.green(`Restored backup: ${result.label} (${result.restored.length} items)`));
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  if (action === 'verify') {
    const label = positional[0];
    if (!label) {
      console.error('Usage: carina ops backup verify <label>');
      process.exit(1);
    }
    const result = await verifyBackup(label);
    if (json) {
      console.log(JSON.stringify({ label, ...result }, null, 2));
      if (!result.ok) process.exit(1);
      return;
    }
    if (result.ok) {
      console.log(chalk.green(`Backup ${label} verified`));
      return;
    }
    console.log(chalk.red(`Backup ${label} failed verification:`));
    for (const err of result.errors) console.log(`  - ${err}`);
    process.exit(1);
  }

  console.error('Usage: carina ops backup <list|create|archive|plan|restore|verify> [label] [--force] [--dry-run] [--json]');
  process.exit(1);
}
