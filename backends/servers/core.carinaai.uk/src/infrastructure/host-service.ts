import fs from 'fs';
import os from 'os';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import { channelRegistry } from '../gateway/channels/channel-registry.js';
import { listAgentDefinitions } from '../workspaces/agent-registry.js';
import { listPairedDevices } from './device-pairing.js';
import { countPendingCommitments } from '../commitments/store.js';

const RUN_DIR = path.join(CARINA_HOME, 'run');
const PID_FILE = path.join(RUN_DIR, 'carina-gateway.pid');
const STARTED_FILE = path.join(RUN_DIR, 'carina-gateway.started');

export type HostServiceStatus = {
  running: boolean;
  pid: number | null;
  startedAt: string | null;
  uptimeSeconds: number;
  hostname: string;
  version: string;
  carinaHome: string;
  webPort: number;
  memoryBackend: string;
  scoutEnabled: boolean;
  channels: Array<{ name: string; enabled: boolean }>;
  agents: number;
  pairedDevices: number;
  cronJobs: number | null;
  pendingCommitments: number;
};

function readPidFile(): number | null {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf-8').trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function writeHostPidFile(pid = process.pid): void {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  fs.writeFileSync(PID_FILE, String(pid));
  if (!fs.existsSync(STARTED_FILE)) {
    fs.writeFileSync(STARTED_FILE, new Date().toISOString());
  }
}

export function clearHostPidFile(): void {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // ignore
  }
}

export function systemdUnitTemplate(execStart = 'carina web'): string {
  const home = CARINA_HOME.replace(/\\/g, '/');
  return `[Unit]
Description=Carina Agent Gateway
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

export function systemdUserUnitPath(): string {
  return path.join(os.homedir(), '.config', 'systemd', 'user', 'carina-gateway.service');
}

export async function installSystemdUserUnit(execStart = 'carina web'): Promise<string> {
  const unitPath = systemdUserUnitPath();
  fs.mkdirSync(path.dirname(unitPath), { recursive: true });
  fs.writeFileSync(unitPath, systemdUnitTemplate(execStart), 'utf-8');
  return unitPath;
}

export async function getHostServiceStatus(version = '0.1.0'): Promise<HostServiceStatus> {
  const pid = readPidFile();
  const running = pid !== null && isProcessAlive(pid);
  let startedAt: string | null = null;
  try {
    startedAt = fs.readFileSync(STARTED_FILE, 'utf-8').trim();
  } catch {
    startedAt = null;
  }
  const uptimeSeconds = startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
    : Math.floor(process.uptime());

  let cronJobs: number | null = null;
  if (process.env.CARINA_SKIP_POSTGRES !== 'true' && process.env.CARINA_LOCAL_MODE !== 'true') {
    try {
      const { listJobs } = await import('../agents/cron-scheduler.js');
      cronJobs = (await listJobs()).filter((j) => j.status === 'active').length;
    } catch {
      cronJobs = null;
    }
  }

  const channelNames = [
    'telegram', 'whatsapp', 'web', 'discord', 'slack', 'sms',
    'signal', 'matrix', 'mattermost', 'dingtalk', 'feishu', 'wechat', 'imessage', 'email',
    'homeassistant', 'api', 'webhooks', 'cli',
  ] as const;
  const channels = channelNames.map((name) => ({
    name,
    enabled: channelRegistry.getByName(name)?.enabled ?? false,
  }));

  return {
    running,
    pid: running ? pid : null,
    startedAt,
    uptimeSeconds,
    hostname: os.hostname(),
    version,
    carinaHome: CARINA_HOME,
    webPort: Number(process.env.WEB_PORT ?? '3000'),
    memoryBackend: process.env.CARINA_MEMORY_BACKEND ?? 'builtin',
    scoutEnabled: process.env.LABYRINTH_ENABLED === 'true',
    channels,
    agents: listAgentDefinitions().length,
    pairedDevices: listPairedDevices().length,
    cronJobs,
    pendingCommitments: countPendingCommitments(),
  };
}
