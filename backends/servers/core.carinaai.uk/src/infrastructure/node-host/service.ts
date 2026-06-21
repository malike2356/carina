import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import type { NodeHostLocalConfig } from './types.js';
import {
  clearNodeHostConfig,
  nodeHostConfigPath,
  readNodeHostConfig,
  writeNodeHostConfig,
} from './store.js';

const execFileAsync = promisify(execFile);

const RUN_DIR = path.join(CARINA_HOME, 'run');
const PID_FILE = path.join(RUN_DIR, 'carina-node-host.pid');

export function nodeHostPidFile(): string {
  return PID_FILE;
}

export function writeNodeHostPid(pid = process.pid): void {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, String(pid));
}

export function clearNodeHostPid(): void {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // ignore
  }
}

export function readNodeHostPid(): number | null {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf-8').trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function isNodeHostRunning(): boolean {
  const pid = readNodeHostPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function systemdNodeHostUnitTemplate(execStart = 'carina node-host start --foreground'): string {
  const home = CARINA_HOME.replace(/\\/g, '/');
  return `[Unit]
Description=Carina Node Host (remote agent)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${home}
Environment=CARINA_HOME=${home}
ExecStart=${execStart}
Restart=on-failure
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30

[Install]
WantedBy=default.target
`;
}

export function systemdNodeHostUnitPath(): string {
  return path.join(os.homedir(), '.config', 'systemd', 'user', 'carina-node-host.service');
}

export async function installNodeHostSystemdUnit(execStart?: string): Promise<string> {
  const unitPath = systemdNodeHostUnitPath();
  fs.mkdirSync(path.dirname(unitPath), { recursive: true });
  fs.writeFileSync(unitPath, systemdNodeHostUnitTemplate(execStart), 'utf-8');
  return unitPath;
}

export async function uninstallNodeHostSystemdUnit(): Promise<boolean> {
  const unitPath = systemdNodeHostUnitPath();
  if (!fs.existsSync(unitPath)) return false;
  fs.unlinkSync(unitPath);
  return true;
}

export function saveLocalNodeConfig(config: NodeHostLocalConfig): void {
  writeNodeHostConfig(config);
}

export function loadLocalNodeConfig(): NodeHostLocalConfig | null {
  return readNodeHostConfig();
}

export function removeLocalNodeConfig(): void {
  clearNodeHostConfig();
}

export async function systemdUserCtl(action: 'start' | 'stop' | 'restart' | 'status'): Promise<string> {
  const { stdout, stderr } = await execFileAsync('systemctl', ['--user', action, 'carina-node-host.service']);
  return (stdout || stderr).trim();
}

export { nodeHostConfigPath };
