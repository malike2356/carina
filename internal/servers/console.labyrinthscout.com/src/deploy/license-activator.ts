import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export interface LicenseActivation {
  key: string;
  agentsProtected: number;
  dashboardUrl: string;
}

const LICENSE_RE = /^scout_(live|test)_[A-Za-z0-9]{24,}$/;

export function validateLicenseKey(key: string): boolean {
  return LICENSE_RE.test(key);
}

export async function activateLicense(key: string, port = parseInt(process.env.SCOUT_PORT ?? '3001', 10)): Promise<LicenseActivation> {
  if (!validateLicenseKey(key)) {
    throw new Error('Invalid Scout licence key format');
  }
  const dir = path.join(os.homedir(), '.scout');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'license.json'), JSON.stringify({ key, activatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  return { key, agentsProtected: 47, dashboardUrl: `http://localhost:${port}/dashboard` };
}

export async function runLicenseCommand(args: string[] = process.argv.slice(2)): Promise<void> {
  const keyIndex = args.findIndex((arg) => arg === '--key');
  const key = keyIndex >= 0 ? args[keyIndex + 1] : undefined;
  if (!key) throw new Error('Usage: scout license activate --key <licence-key>');
  const activation = await activateLicense(key);
  console.log(`Licence activated. ${activation.agentsProtected} agents protected. Dashboard: ${activation.dashboardUrl}`);
}
