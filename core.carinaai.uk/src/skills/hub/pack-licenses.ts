import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { CARINA_HOME } from '../../config/paths.js';
import { hubPool } from './migrations.js';

export type PackPricingTier = 'free' | 'premium' | 'certified';

export interface PackLicenseRecord {
  packName: string;
  token: string;
  email: string;
  purchasedAt: string;
}

export interface PackLicensesFile {
  licenses: Record<string, PackLicenseRecord>;
}

export const PACK_LICENSES_PATH = path.join(CARINA_HOME, 'pack-licenses.json');

export function isPaidPackTier(tier: PackPricingTier | string | null | undefined): boolean {
  return tier === 'premium';
}

export function packRequiresLicense(
  tier: PackPricingTier | string | null | undefined,
  priceGbpCents: number | null | undefined,
): boolean {
  return tier === 'premium' && (priceGbpCents ?? 0) > 0;
}

export function generateLicenseToken(): string {
  return `pack_${crypto.randomBytes(24).toString('hex')}`;
}

export async function readPackLicensesFile(): Promise<PackLicensesFile> {
  try {
    const raw = await fs.readFile(PACK_LICENSES_PATH, 'utf8');
    const parsed = JSON.parse(raw) as PackLicensesFile;
    return { licenses: parsed.licenses ?? {} };
  } catch {
    return { licenses: {} };
  }
}

export async function writePackLicense(record: PackLicenseRecord): Promise<void> {
  const file = await readPackLicensesFile();
  file.licenses[record.packName] = record;
  await fs.mkdir(CARINA_HOME, { recursive: true });
  await fs.writeFile(PACK_LICENSES_PATH, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}

export async function getLocalPackLicense(packName: string): Promise<PackLicenseRecord | null> {
  const file = await readPackLicensesFile();
  return file.licenses[packName] ?? null;
}

export async function validatePackLicense(
  packName: string,
  token: string,
): Promise<boolean> {
  if (!token.trim()) return false;
  const result = await hubPool.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM pack_licenses
     WHERE pack_name = $1 AND license_token = $2 AND revoked_at IS NULL`,
    [packName, token],
  );
  return Number(result.rows[0]?.count ?? 0) > 0;
}

export async function grantPackLicense(input: {
  packName: string;
  email: string;
  stripeSessionId: string;
}): Promise<PackLicenseRecord> {
  const existing = await hubPool.query<{ license_token: string; created_at: string }>(
    `SELECT license_token, created_at FROM pack_licenses
     WHERE stripe_session_id = $1 AND revoked_at IS NULL`,
    [input.stripeSessionId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    const row = existing.rows[0];
    return {
      packName: input.packName,
      token: String(row.license_token),
      email: input.email,
      purchasedAt: new Date(String(row.created_at)).toISOString(),
    };
  }

  const token = generateLicenseToken();
  await hubPool.query(
    `INSERT INTO pack_licenses (pack_name, license_token, purchaser_email, stripe_session_id)
     VALUES ($1, $2, $3, $4)`,
    [input.packName, token, input.email.toLowerCase(), input.stripeSessionId],
  );

  return {
    packName: input.packName,
    token,
    email: input.email.toLowerCase(),
    purchasedAt: new Date().toISOString(),
  };
}
