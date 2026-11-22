/**
 * Scout integration stub (retired 2026-11-22).
 * Real client archived at archive/carina-stripped-aiva-scout-20261122/.
 * Scout research product: malike2356/scout / local scout/.
 */

export const SCOUT_BASE = '';
export const SCOUT_CONSOLE_BASE = '';
export const SCOUT_DASHBOARD_API = '';

export function scoutHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

export interface ScoutResponse {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

const retired: ScoutResponse = {
  ok: false,
  status: 503,
  error: 'Scout integration removed from Carina (2026-11-22)',
};

export async function scoutGet(_path: string): Promise<ScoutResponse> {
  return retired;
}

export async function scoutPost(_path: string, _body?: unknown): Promise<ScoutResponse> {
  return retired;
}

export async function scoutPut(_path: string, _body?: unknown): Promise<ScoutResponse> {
  return retired;
}

export async function scoutConsoleGet(_path: string): Promise<ScoutResponse> {
  return retired;
}

export async function scoutConsoleGetDetailed(_path: string): Promise<ScoutResponse> {
  return retired;
}

export async function scoutConsolePut(_path: string, _body?: unknown): Promise<ScoutResponse> {
  return retired;
}

export async function scoutConsolePost(_path: string, _body?: unknown): Promise<ScoutResponse> {
  return retired;
}
