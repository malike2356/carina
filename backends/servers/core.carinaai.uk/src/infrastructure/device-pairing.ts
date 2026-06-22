import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../config/paths.js';
import { parseDeviceScopes } from './device-scopes.js';

const DEVICES_FILE = path.join(CARINA_HOME, 'devices.json');
const LEGACY_PAIRING_FILE = path.join(CARINA_HOME, 'pairing.json');
const CODE_TTL_MS = 15 * 60 * 1000;

export type PairedDevice = {
  id: string;
  name: string;
  platform: string;
  tokenHash: string;
  publicKey?: string;
  pairedAt: string;
  lastSeenAt: string;
  scopes: string[];
};

export type PendingPairing = {
  code: string;
  createdAt: string;
  expiresAt: string;
};

type DeviceStore = {
  version: number;
  pending?: PendingPairing;
  devices: PairedDevice[];
};

function emptyStore(): DeviceStore {
  return { version: 1, devices: [] };
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function loadStore(): DeviceStore {
  if (fs.existsSync(DEVICES_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8')) as DeviceStore;
      return { ...emptyStore(), ...raw, devices: raw.devices ?? [] };
    } catch {
      return emptyStore();
    }
  }
  if (fs.existsSync(LEGACY_PAIRING_FILE)) {
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_PAIRING_FILE, 'utf-8')) as PendingPairing;
      if (legacy.code && legacy.expiresAt && new Date(legacy.expiresAt).getTime() > Date.now()) {
        return { version: 1, pending: legacy, devices: [] };
      }
    } catch {
      // ignore
    }
  }
  return emptyStore();
}

function saveStore(store: DeviceStore): void {
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  fs.writeFileSync(DEVICES_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

function generateCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function generateToken(): string {
  return `cdv_${crypto.randomBytes(24).toString('base64url')}`;
}

export function createPairingCode(): PendingPairing {
  const store = loadStore();
  const pending: PendingPairing = {
    code: generateCode(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  };
  store.pending = pending;
  saveStore(store);
  try {
    fs.unlinkSync(LEGACY_PAIRING_FILE);
  } catch {
    // ignore
  }
  return pending;
}

export function getPendingPairing(): PendingPairing | null {
  const store = loadStore();
  if (!store.pending) return null;
  if (new Date(store.pending.expiresAt).getTime() <= Date.now()) {
    store.pending = undefined;
    saveStore(store);
    return null;
  }
  return store.pending;
}

export type ClaimPairingInput = {
  code: string;
  name: string;
  platform: string;
  scopes?: string[];
  publicKey?: string;
};

export type ClaimPairingResult = {
  deviceId: string;
  token: string;
  name: string;
  platform: string;
};

export function claimPairing(input: ClaimPairingInput): ClaimPairingResult {
  const store = loadStore();
  const pending = store.pending;
  if (!pending || pending.code.toUpperCase() !== input.code.toUpperCase()) {
    throw new Error('Invalid or expired pairing code');
  }
  if (new Date(pending.expiresAt).getTime() <= Date.now()) {
    store.pending = undefined;
    saveStore(store);
    throw new Error('Pairing code expired');
  }

  const token = generateToken();
  const device: PairedDevice = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'Paired device',
    platform: input.platform.trim() || 'unknown',
    tokenHash: hashToken(token),
    publicKey: input.publicKey?.trim() || undefined,
    pairedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    scopes: parseDeviceScopes(input.scopes),
  };
  store.devices.push(device);
  store.pending = undefined;
  saveStore(store);

  return {
    deviceId: device.id,
    token,
    name: device.name,
    platform: device.platform,
  };
}

export function listPairedDevices(): PairedDevice[] {
  return loadStore().devices;
}

export function getPairedDeviceById(deviceId: string): PairedDevice | undefined {
  return loadStore().devices.find((device) => device.id === deviceId);
}

export function registerDevicePublicKey(deviceId: string, publicKey: string): boolean {
  const store = loadStore();
  const device = store.devices.find((entry) => entry.id === deviceId);
  if (!device) return false;
  device.publicKey = publicKey.trim();
  device.lastSeenAt = new Date().toISOString();
  saveStore(store);
  return true;
}

export function revokePairedDevice(deviceId: string): boolean {
  const store = loadStore();
  const before = store.devices.length;
  store.devices = store.devices.filter((d) => d.id !== deviceId);
  if (store.devices.length === before) return false;
  saveStore(store);
  return true;
}

export function rotateDeviceToken(deviceId: string): { device: PairedDevice; token: string } | null {
  const store = loadStore();
  const device = store.devices.find((d) => d.id === deviceId);
  if (!device) return null;
  const token = generateToken();
  device.tokenHash = hashToken(token);
  device.lastSeenAt = new Date().toISOString();
  saveStore(store);
  return { device, token };
}

export function validateDeviceToken(token: string): PairedDevice | null {
  if (!token.startsWith('cdv_')) return null;
  const store = loadStore();
  const hash = hashToken(token);
  const device = store.devices.find((d) => d.tokenHash === hash);
  if (!device) return null;
  device.lastSeenAt = new Date().toISOString();
  saveStore(store);
  return device;
}

export function redactDevicesForApi(devices: PairedDevice[]): Array<{
  id: string;
  name: string;
  platform: string;
  pairedAt: string;
  lastSeenAt: string;
  scopes: string[];
}> {
  return devices.map((d) => ({
    id: d.id,
    name: d.name,
    platform: d.platform,
    pairedAt: d.pairedAt,
    lastSeenAt: d.lastSeenAt,
    scopes: d.scopes,
  }));
}

export function migrateLegacyPairingStore(homeDir = CARINA_HOME): {
  migrated: boolean;
  message?: string;
  guidance?: string;
} {
  const devicesFile = path.join(homeDir, 'devices.json');
  const legacyPairingFile = path.join(homeDir, 'pairing.json');
  if (!fs.existsSync(legacyPairingFile) || fs.existsSync(devicesFile)) {
    return { migrated: false, guidance: 'No legacy pairing.json to migrate.' };
  }

  let store: DeviceStore = emptyStore();
  try {
    const legacy = JSON.parse(fs.readFileSync(legacyPairingFile, 'utf-8')) as PendingPairing;
    if (legacy.code && legacy.expiresAt) {
      store.pending = legacy;
    }
  } catch {
    return { migrated: false, guidance: 'pairing.json is corrupt; remove it manually after backup.' };
  }

  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(devicesFile, JSON.stringify(store, null, 2), { mode: 0o600 });
  try {
    fs.unlinkSync(legacyPairingFile);
  } catch {
    // ignore
  }
  return { migrated: true, message: 'migrated pairing.json to devices.json' };
}
