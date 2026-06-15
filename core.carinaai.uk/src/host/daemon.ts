import { spawn, type ChildProcess } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';
import {
  clearHostPidFile,
  installSystemdUserUnit,
  systemdUnitTemplate,
  systemdUserUnitPath,
  writeHostPidFile,
} from '../infrastructure/host-service.js';

const execFileAsync = promisify(execFile);

export const DAEMON_PID_FILE = path.join(CARINA_HOME, 'daemon.pid');
export const DAEMON_LOG_FILE = path.join(CARINA_HOME, 'daemon.log');
export const DAEMON_STARTED_FILE = path.join(CARINA_HOME, 'daemon.started');
export const MAX_LOG_BYTES = 10 * 1024 * 1024;

export type ServiceManager = 'systemd' | 'launchd' | 'schtasks' | 'none';

export type DaemonStatus = {
  running: boolean;
  pid: number | null;
  uptimeSeconds: number;
  startedAt: string | null;
  lastError: string | null;
  serviceManager: ServiceManager;
  url: string;
  gatewayPort: number;
};

function ensureCarinaHome(): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
}

export function detectServiceManager(): ServiceManager {
  if (process.platform === 'linux') {
    if (fs.existsSync('/run/systemd/system') || process.env.INVOCATION_ID) return 'systemd';
    return 'none';
  }
  if (process.platform === 'darwin') {
    return fs.existsSync('/bin/launchctl') ? 'launchd' : 'none';
  }
  if (process.platform === 'win32') return 'schtasks';
  return 'none';
}

export function gatewayPort(): number {
  return Number(process.env.WEB_PORT ?? process.env.CARINA_PORT ?? process.env.PORT ?? '7430');
}

export function defaultGatewayCommand(): string {
  return 'carina serve';
}

export function launchdPlistPath(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.carina.gateway.plist');
}

export function launchdPlistTemplate(execStart = defaultGatewayCommand()): string {
  const home = CARINA_HOME.replace(/\\/g, '/');
  const log = DAEMON_LOG_FILE.replace(/\\/g, '/');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.carina.gateway</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-lc</string>
    <string>${execStart}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${home}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CARINA_HOME</key>
    <string>${home}</string>
    <key>WEB_PORT</key>
    <string>${String(gatewayPort())}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${log}</string>
  <key>StandardErrorPath</key>
  <string>${log}</string>
</dict>
</plist>
`;
}

export function rotateDaemonLogIfNeeded(): void {
  try {
    if (!fs.existsSync(DAEMON_LOG_FILE)) return;
    const size = fs.statSync(DAEMON_LOG_FILE).size;
    if (size < MAX_LOG_BYTES) return;
    const rotated = `${DAEMON_LOG_FILE}.${Date.now()}`;
    fs.renameSync(DAEMON_LOG_FILE, rotated);
  } catch {
    // ignore rotation errors
  }
}

export function appendDaemonLog(line: string): void {
  ensureCarinaHome();
  rotateDaemonLogIfNeeded();
  const stamp = new Date().toISOString();
  fs.appendFileSync(DAEMON_LOG_FILE, `[${stamp}] ${line}\n`, 'utf8');
}

export function readDaemonLogTail(maxLines = 40): string[] {
  try {
    const raw = fs.readFileSync(DAEMON_LOG_FILE, 'utf8');
    return raw.trim().split('\n').slice(-maxLines);
  } catch {
    return [];
  }
}

export function getLastDaemonError(): string | null {
  const lines = readDaemonLogTail(80);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]!;
    if (/error|failed|crash/i.test(line)) return line;
  }
  return null;
}

export function readDaemonPid(): number | null {
  try {
    const pid = Number(fs.readFileSync(DAEMON_PID_FILE, 'utf8').trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function writeDaemonPid(pid: number): void {
  ensureCarinaHome();
  fs.writeFileSync(DAEMON_PID_FILE, String(pid));
  if (!fs.existsSync(DAEMON_STARTED_FILE)) {
    fs.writeFileSync(DAEMON_STARTED_FILE, new Date().toISOString());
  }
  writeHostPidFile(pid);
}

export function clearDaemonPid(): void {
  try {
    fs.unlinkSync(DAEMON_PID_FILE);
  } catch {
    // ignore
  }
  clearHostPidFile();
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isDaemonRunning(): boolean {
  const pid = readDaemonPid();
  return pid !== null && isProcessAlive(pid);
}

function localGatewayUrl(): string {
  return `http://127.0.0.1:${gatewayPort()}`;
}

export function getDaemonStatus(): DaemonStatus {
  const pid = readDaemonPid();
  const running = pid !== null && isProcessAlive(pid);
  let startedAt: string | null = null;
  try {
    startedAt = fs.readFileSync(DAEMON_STARTED_FILE, 'utf8').trim();
  } catch {
    startedAt = null;
  }
  const uptimeSeconds = startedAt && running
    ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    : 0;

  return {
    running,
    pid: running ? pid : null,
    uptimeSeconds,
    startedAt,
    lastError: getLastDaemonError(),
    serviceManager: detectServiceManager(),
    url: localGatewayUrl(),
    gatewayPort: gatewayPort(),
  };
}

async function trySystemdCtl(action: 'start' | 'stop' | 'restart' | 'status'): Promise<string | null> {
  if (!fs.existsSync(systemdUserUnitPath())) return null;
  try {
    const { stdout, stderr } = await execFileAsync('systemctl', ['--user', action, 'carina-gateway.service']);
    return (stdout || stderr).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendDaemonLog(`systemctl --user ${action} failed: ${msg}`);
    return null;
  }
}

async function tryLaunchctl(action: 'load' | 'unload' | 'start' | 'stop'): Promise<boolean> {
  const plist = launchdPlistPath();
  if (!fs.existsSync(plist)) return false;
  try {
    if (action === 'load') {
      await execFileAsync('launchctl', ['load', plist]);
    } else if (action === 'unload') {
      await execFileAsync('launchctl', ['unload', plist]);
    } else if (action === 'start') {
      await execFileAsync('launchctl', ['start', 'com.carina.gateway']);
    } else {
      await execFileAsync('launchctl', ['stop', 'com.carina.gateway']);
    }
    return true;
  } catch {
    return false;
  }
}

export async function installHostService(execStart = defaultGatewayCommand()): Promise<{
  manager: ServiceManager;
  path?: string;
}> {
  const manager = detectServiceManager();
  ensureCarinaHome();

  if (manager === 'systemd') {
    const unitPath = await installSystemdUserUnit(execStart);
    appendDaemonLog(`Installed systemd user unit at ${unitPath}`);
    return { manager, path: unitPath };
  }

  if (manager === 'launchd') {
    const plistPath = launchdPlistPath();
    fs.mkdirSync(path.dirname(plistPath), { recursive: true });
    fs.writeFileSync(plistPath, launchdPlistTemplate(execStart), 'utf8');
    appendDaemonLog(`Installed launchd plist at ${plistPath}`);
    return { manager, path: plistPath };
  }

  if (manager === 'schtasks') {
    const taskName = 'CarinaGateway';
    const cmd = `schtasks /Create /TN ${taskName} /TR "${execStart}" /SC ONLOGON /RL LIMITED /F`;
    appendDaemonLog(`Windows install command: ${cmd}`);
    return { manager };
  }

  appendDaemonLog('No OS service manager detected; use carina host start for foreground supervisor');
  return { manager: 'none' };
}

export async function uninstallHostService(): Promise<void> {
  const manager = detectServiceManager();

  if (manager === 'systemd') {
    const unitPath = systemdUserUnitPath();
    if (fs.existsSync(unitPath)) fs.unlinkSync(unitPath);
  } else if (manager === 'launchd') {
    const plist = launchdPlistPath();
    await tryLaunchctl('unload');
    if (fs.existsSync(plist)) fs.unlinkSync(plist);
  }

  clearDaemonPid();
  appendDaemonLog('Host service uninstalled');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parseGatewayCommand(execStart: string): { command: string; args: string[] } {
  const trimmed = execStart.trim();
  if (trimmed.startsWith('carina ')) {
    return { command: 'carina', args: trimmed.slice('carina '.length).split(/\s+/).filter(Boolean) };
  }
  return { command: 'sh', args: ['-lc', trimmed] };
}

export async function runGatewaySupervisor(options: {
  execStart?: string;
  signal?: AbortSignal;
} = {}): Promise<void> {
  const execStart = options.execStart ?? defaultGatewayCommand();
  const parsed = parseGatewayCommand(execStart);
  let backoffMs = 1000;
  let child: ChildProcess | null = null;

  const shutdown = () => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  };

  options.signal?.addEventListener('abort', shutdown, { once: true });

  appendDaemonLog(`Supervisor started (${execStart})`);

  while (!options.signal?.aborted) {
    await new Promise<void>((resolve, reject) => {
      child = spawn(parsed.command, parsed.args, {
        env: {
          ...process.env,
          CARINA_HOME,
          WEB_PORT: String(gatewayPort()),
          PORT: String(gatewayPort()),
          WEB_ENABLED: 'true',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (!child.pid) {
        reject(new Error('Failed to spawn gateway process'));
        return;
      }

      writeDaemonPid(child.pid);
      appendDaemonLog(`Gateway spawned pid=${child.pid}`);

      child.stdout?.on('data', (chunk: Buffer) => {
        appendDaemonLog(chunk.toString('utf8').trim());
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        appendDaemonLog(`stderr: ${chunk.toString('utf8').trim()}`);
      });

      child.on('exit', (code, signal) => {
        appendDaemonLog(`Gateway exited code=${code ?? 'null'} signal=${signal ?? 'null'}`);
        clearDaemonPid();
        resolve();
      });

      child.on('error', (err) => {
        appendDaemonLog(`Gateway error: ${err.message}`);
        clearDaemonPid();
        resolve();
      });
    });

    if (options.signal?.aborted) break;

    appendDaemonLog(`Restarting gateway in ${backoffMs}ms`);
    await new Promise((r) => setTimeout(r, backoffMs));
    backoffMs = Math.min(backoffMs * 2, 60_000);
  }

  appendDaemonLog('Supervisor stopped');
}

export async function startHostService(execStart = defaultGatewayCommand()): Promise<{ pid: number; url: string }> {
  if (isDaemonRunning()) {
    const pid = readDaemonPid()!;
    return { pid, url: localGatewayUrl() };
  }

  const manager = detectServiceManager();
  if (manager === 'systemd' && fs.existsSync(systemdUserUnitPath())) {
    await trySystemdCtl('start');
    await new Promise((r) => setTimeout(r, 500));
    const pid = readDaemonPid();
    if (pid) return { pid, url: localGatewayUrl() };
  }

  if (manager === 'launchd' && fs.existsSync(launchdPlistPath())) {
    await tryLaunchctl('start');
    await new Promise((r) => setTimeout(r, 500));
    const pid = readDaemonPid();
    if (pid) return { pid, url: localGatewayUrl() };
  }

  const child = spawn('carina', ['host', 'supervise'], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CARINA_HOST_EXEC_START: execStart,
      CARINA_HOME,
    },
  });

  child.unref();
  if (!child.pid) throw new Error('Failed to start host supervisor');

  writeDaemonPid(child.pid);
  appendDaemonLog(`Background supervisor started pid=${child.pid}`);
  return { pid: child.pid, url: localGatewayUrl() };
}

export async function stopHostService(timeoutMs = 5000): Promise<boolean> {
  const manager = detectServiceManager();
  if (manager === 'systemd' && fs.existsSync(systemdUserUnitPath())) {
    await trySystemdCtl('stop');
  } else if (manager === 'launchd' && fs.existsSync(launchdPlistPath())) {
    await tryLaunchctl('stop');
  }

  const pid = readDaemonPid();
  if (!pid) {
    clearDaemonPid();
    return true;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    clearDaemonPid();
    return true;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      clearDaemonPid();
      appendDaemonLog(`Gateway stopped pid=${pid}`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // ignore
  }
  clearDaemonPid();
  return !isProcessAlive(pid);
}

export async function restartHostService(execStart = defaultGatewayCommand()): Promise<{ pid: number; url: string }> {
  await stopHostService();
  return startHostService(execStart);
}

export function followDaemonLog(onLine: (line: string) => void): fs.FSWatcher {
  ensureCarinaHome();
  if (!fs.existsSync(DAEMON_LOG_FILE)) {
    fs.writeFileSync(DAEMON_LOG_FILE, '', 'utf8');
  }
  let position = fs.statSync(DAEMON_LOG_FILE).size;
  return fs.watch(DAEMON_LOG_FILE, () => {
    const stat = fs.statSync(DAEMON_LOG_FILE);
    if (stat.size < position) position = 0;
    const stream = fs.createReadStream(DAEMON_LOG_FILE, { start: position, end: stat.size });
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) onLine(line);
      }
    });
    position = stat.size;
  });
}

export { systemdUnitTemplate, systemdUserUnitPath, shellQuote };
