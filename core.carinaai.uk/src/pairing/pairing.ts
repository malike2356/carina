import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';
import {
  listPairedDevices,
  revokePairedDevice,
  redactDevicesForApi,
  validateDeviceToken,
} from '../infrastructure/device-pairing.js';

const TOKEN_TTL_MS = 5 * 60 * 1000;
const PENDING_FILE = path.join(CARINA_HOME, 'pair-pending-tokens.json');
const DEVICES_FILE = path.join(CARINA_HOME, 'devices.json');

type PendingToken = {
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  consumed: boolean;
  deviceId?: string;
};

type PendingStore = {
  version: number;
  tokens: PendingToken[];
};

type DeviceRow = {
  id: string;
  name: string;
  platform: string;
  tokenHash: string;
  pairedAt: string;
  lastSeenAt: string;
  scopes: string[];
};

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function loadPendingStore(): PendingStore {
  if (!fs.existsSync(PENDING_FILE)) return { version: 1, tokens: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')) as PendingStore;
    return { version: 1, tokens: raw.tokens ?? [] };
  } catch {
    return { version: 1, tokens: [] };
  }
}

function savePendingStore(store: PendingStore): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

function pruneExpired(store: PendingStore): PendingStore {
  const now = Date.now();
  return {
    ...store,
    tokens: store.tokens.filter((t) => new Date(t.expiresAt).getTime() > now),
  };
}

function loadDevicesFile(): { devices: DeviceRow[] } {
  if (!fs.existsSync(DEVICES_FILE)) return { devices: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8')) as { devices?: DeviceRow[] };
    return { devices: raw.devices ?? [] };
  } catch {
    return { devices: [] };
  }
}

function saveDevicesFile(devices: DeviceRow[]): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  const existing = loadDevicesFile();
  fs.writeFileSync(DEVICES_FILE, JSON.stringify({ ...existing, version: 1, devices }, null, 2), { mode: 0o600 });
}

function generateDeviceToken(): string {
  return `cdv_${crypto.randomBytes(24).toString('base64url')}`;
}

export function getLocalLanIp(): string {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return '127.0.0.1';
}

export function buildPairUri(token: string, port = Number(process.env.WEB_PORT ?? process.env.CARINA_PORT ?? '7430')): string {
  const host = getLocalLanIp();
  return `carina://pair?token=${token}&host=${host}&port=${port}`;
}

export function renderTerminalQr(data: string, size = 10): string {
  const hash = crypto.createHash('sha256').update(data).digest();
  const rows: string[] = [];
  for (let y = 0; y < size; y += 1) {
    let row = '';
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) % hash.length;
      const bit = hash[idx]! & 1;
      row += bit ? '██' : '  ';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

export function createPairingToken(): { token: string; expiresAt: string; uri: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const store = pruneExpired(loadPendingStore());
  const pending: PendingToken = {
    tokenHash: hashToken(token),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    consumed: false,
  };
  store.tokens.push(pending);
  savePendingStore(store);
  return {
    token,
    expiresAt: pending.expiresAt,
    uri: buildPairUri(token),
  };
}

export type AcceptPairingResult = {
  deviceId: string;
  status: 'paired';
  token: string;
};

export function acceptPairingToken(token: string, deviceName: string): AcceptPairingResult {
  const store = pruneExpired(loadPendingStore());
  const hash = hashToken(token);
  const pending = store.tokens.find((t) => t.tokenHash === hash && !t.consumed);
  if (!pending) throw new Error('Invalid or expired pairing token');
  if (new Date(pending.expiresAt).getTime() <= Date.now()) {
    savePendingStore({ ...store, tokens: store.tokens.filter((t) => t.tokenHash !== hash) });
    throw new Error('Pairing token expired');
  }

  const bearer = generateDeviceToken();
  const device: DeviceRow = {
    id: crypto.randomUUID(),
    name: deviceName.trim() || 'Paired device',
    platform: 'mobile',
    tokenHash: hashToken(bearer),
    pairedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    scopes: ['chat', 'control'],
  };

  pending.consumed = true;
  pending.deviceId = device.id;
  savePendingStore(store);

  const devices = loadDevicesFile().devices;
  devices.push(device);
  saveDevicesFile(devices);

  return {
    deviceId: device.id,
    status: 'paired',
    token: bearer,
  };
}

export function listPairDevicesForApi(): Array<{
  id: string;
  name: string;
  lastSeen: string;
  platform: string;
}> {
  return redactDevicesForApi(listPairedDevices()).map((d) => ({
    id: d.id,
    name: d.name,
    lastSeen: d.lastSeenAt,
    platform: d.platform,
  }));
}

export function revokePairDevice(deviceId: string): boolean {
  return revokePairedDevice(deviceId);
}

export function isPairingTokenExpired(token: string): boolean {
  const store = loadPendingStore();
  const hash = hashToken(token);
  const pending = store.tokens.find((t) => t.tokenHash === hash);
  if (!pending) return true;
  return new Date(pending.expiresAt).getTime() <= Date.now();
}

export function waitForPairingByToken(
  token: string,
  timeoutMs = TOKEN_TTL_MS,
  pollMs = 2000,
): Promise<AcceptPairingResult | null> {
  const hash = hashToken(token);
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const store = loadPendingStore();
      const pending = store.tokens.find((t) => t.tokenHash === hash);
      if (!pending) {
        clearInterval(timer);
        resolve(null);
        return;
      }
      if (!pending.consumed || !pending.deviceId) {
        if (Date.now() > deadline) {
          clearInterval(timer);
          resolve(null);
        }
        return;
      }
      clearInterval(timer);
      resolve({
        deviceId: pending.deviceId,
        status: 'paired',
        token: '',
      });
    }, pollMs);
  });
}

export function validatePairDeviceAuth(token: string) {
  return validateDeviceToken(token);
}
