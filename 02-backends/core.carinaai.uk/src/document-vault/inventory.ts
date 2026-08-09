import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  VaultInventoryManifest,
  VaultInventorySnapshot,
} from './types.js';
import { DOCUMENT_VAULT_CONTRACT_VERSION } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DOCUMENT_VAULT_CONTRACT_ROOT = path.resolve(
  here,
  '../../contracts/aiva-document-vault.v1',
);

function loadJson<T>(fileName: string): T {
  const full = path.join(DOCUMENT_VAULT_CONTRACT_ROOT, fileName);
  return JSON.parse(readFileSync(full, 'utf8')) as T;
}

export function loadDocumentVaultContractManifest(): {
  contract: string;
  version: string;
  authority: string;
  phase: string;
} {
  return loadJson('contract.json');
}

export function loadDocumentVaultInventory(): VaultInventoryManifest {
  return loadJson('inventory.json');
}

export function loadDocumentVaultOwnershipMatrix(): Record<string, unknown> {
  return loadJson('ownership-matrix.json');
}

export function loadDocumentVaultMigrationManifest(): Record<string, unknown> {
  return loadJson('migration-manifest.json');
}

export function loadSyntheticInventorySnapshot(): VaultInventorySnapshot {
  return loadJson('fixtures/synthetic/inventory-snapshot.json');
}

export function assertContractVersionAligned(): void {
  const manifest = loadDocumentVaultContractManifest();
  if (manifest.version !== DOCUMENT_VAULT_CONTRACT_VERSION) {
    throw new Error(
      `Document vault contract version mismatch: code=${DOCUMENT_VAULT_CONTRACT_VERSION} manifest=${manifest.version}`,
    );
  }
}

/** Paths in inventory are relative to the Carina monorepo root. */
export function carinaRepoRootFromContract(): string {
  return path.resolve(DOCUMENT_VAULT_CONTRACT_ROOT, '../../../..');
}
