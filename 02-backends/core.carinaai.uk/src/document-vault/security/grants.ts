/** Agent/channel grant checks for Document Vault (prompt 714). */

import { VaultError } from '../errors.js';

export const KNOWN_GRANTS = Object.freeze([
  'vault.read',
  'vault.write',
  'vault.search',
  'vault.index',
  'vault.export',
  'vault.admin',
] as const);

/**
 * Empty/undefined grants mean full access for trusted session actors (web UI / owner).
 * Explicit grant lists (channel bindings) are restricted.
 */
export function requireGrant(grants: readonly string[] | null | undefined, needed: string): void {
  if (grants == null) return;
  const normalized = new Set(
    [...grants].map((g) => String(g).trim()).filter(Boolean),
  );
  if (!normalized.size) return;
  if (normalized.has('vault.admin')) return;
  if (!normalized.has(needed)) {
    throw new VaultError(`missing grant ${needed}`, 'forbidden');
  }
}
