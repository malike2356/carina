import fs from 'node:fs';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';

const WEB_PORT_STATE_FILE = path.join(CARINA_HOME, 'web-port.json');

export type WebGatewayPortState = {
  port: number;
  updatedAt: string;
};

export function readPersistedWebGatewayPort(): number | null {
  try {
    const raw = JSON.parse(fs.readFileSync(WEB_PORT_STATE_FILE, 'utf8')) as Partial<WebGatewayPortState>;
    const port = Number(raw.port);
    return Number.isFinite(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

export function writePersistedWebGatewayPort(port: number): void {
  if (!Number.isFinite(port) || port <= 0) return;
  fs.mkdirSync(CARINA_HOME, { recursive: true });
  const state: WebGatewayPortState = {
    port,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(WEB_PORT_STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

export function resolveKnownWebGatewayPort(fallbackPort = 7430): number {
  const envPort = Number.parseInt(process.env.WEB_PORT?.trim() ?? process.env.PORT?.trim() ?? '', 10);
  if (Number.isFinite(envPort) && envPort > 0) return envPort;
  const persisted = readPersistedWebGatewayPort();
  if (persisted !== null) return persisted;
  return fallbackPort;
}

export function resolveKnownWebGatewayUrl(fallbackPort = 7430): string {
  return `http://127.0.0.1:${resolveKnownWebGatewayPort(fallbackPort)}`;
}
