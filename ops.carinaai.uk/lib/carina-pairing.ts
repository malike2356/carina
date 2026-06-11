import { carinaGet, carinaOpsTokenSet } from './carina.js';
import { readCoreOpsToken, resolveCoreEnvPath } from './core-env.js';
import { OPS_ENV_PATH, setEnvVar } from './env.js';

export type CarinaPairResult = {
  ok: boolean;
  alreadyPaired?: boolean;
  auto?: boolean;
  error?: string;
};

export async function testCarinaConnection(): Promise<boolean> {
  if (!carinaOpsTokenSet()) return false;
  try {
    const response = await carinaGet('/api/ops/health');
    return response.ok;
  } catch {
    return false;
  }
}

export async function pairCarinaOpsToken(token: string): Promise<CarinaPairResult> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, error: 'Ops token is required' };
  }
  setEnvVar(OPS_ENV_PATH, 'CARINA_OPS_TOKEN', trimmed);
  const live = await testCarinaConnection();
  if (!live) {
    return {
      ok: false,
      error: 'Token saved locally but Carina rejected it. Check CARINA_API_URL and the token on core.',
    };
  }
  return { ok: true };
}

export async function autoPairCarinaFromLocalCore(): Promise<CarinaPairResult> {
  if (await testCarinaConnection()) {
    return { ok: true, alreadyPaired: true };
  }
  const token = readCoreOpsToken();
  if (!token) {
    return {
      ok: false,
      error: `No CARINA_OPS_TOKEN found in ${resolveCoreEnvPath()}. Paste the token manually below.`,
    };
  }
  setEnvVar(OPS_ENV_PATH, 'CARINA_OPS_TOKEN', token);
  const live = await testCarinaConnection();
  if (!live) {
    return {
      ok: false,
      error: 'Read token from core .env but Carina rejected the connection. Check CARINA_API_URL.',
    };
  }
  return { ok: true, auto: true };
}
