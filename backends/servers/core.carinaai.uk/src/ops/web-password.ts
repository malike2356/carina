import bcrypt from 'bcryptjs';
import { setEnvVarInFile } from './env-file.js';

const MIN_PASSWORD_LENGTH = 8;

export type WebPasswordStatus = {
  set: boolean;
  updatedAt: string | null;
  actor: string | null;
};

let lastUpdateMeta: { at: string; actor: string } | null = null;

export function getWebPasswordStatus(): WebPasswordStatus {
  const current = process.env.CARINA_WEB_PASSWORD ?? '';
  return {
    set: current.length > 0,
    updatedAt: lastUpdateMeta?.at ?? null,
    actor: lastUpdateMeta?.actor ?? null,
  };
}

export async function setWebPassword(
  password: string,
  confirmPassword: string,
  actor = 'ops-admin',
): Promise<{ updatedAt: string }> {
  const next = password.trim();
  const confirm = confirmPassword.trim();
  if (next.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (next !== confirm) {
    throw new Error('Passwords do not match');
  }

  const hash = await bcrypt.hash(next, 10);
  setEnvVarInFile('CARINA_WEB_PASSWORD', hash);
  process.env.CARINA_WEB_PASSWORD = hash;

  const updatedAt = new Date().toISOString();
  lastUpdateMeta = { at: updatedAt, actor };
  console.log(`[ops] CARINA_WEB_PASSWORD updated by ${actor} at ${updatedAt}`);
  return { updatedAt };
}
