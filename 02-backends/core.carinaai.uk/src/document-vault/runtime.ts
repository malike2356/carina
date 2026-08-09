/**
 * Shared Document Vault service singleton (tests + channel + agent tools).
 */

import { createDefaultContentStore } from './content-store.js';
import { DocumentVaultService } from './service.js';

let testService: DocumentVaultService | null = null;

export function setDocumentVaultToolServiceForTests(service: DocumentVaultService | null): void {
  testService = service;
}

export function isDocumentVaultTestServiceActive(): boolean {
  return testService != null;
}

export function getOrCreateLocalVaultService(): DocumentVaultService {
  if (testService) return testService;
  const g = globalThis as unknown as { __carinaVaultSvc?: DocumentVaultService };
  if (!g.__carinaVaultSvc) {
    const root = process.env.CARINA_HOME || process.env.TMPDIR || '/tmp';
    g.__carinaVaultSvc = new DocumentVaultService(
      createDefaultContentStore(`${root}/document-vault-agent`),
      { dbPath: process.env.DOCUMENT_VAULT_SQLITE_PATH },
    );
  }
  return g.__carinaVaultSvc;
}
