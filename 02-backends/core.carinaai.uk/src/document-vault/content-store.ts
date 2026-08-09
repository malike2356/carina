import fs from 'node:fs';
import path from 'node:path';
import { sha256Hex, type VaultStorageLocator } from './model.js';

export type VaultBlobPutResult = {
  locator: VaultStorageLocator;
  byteSize: number;
  checksum: string;
};

export interface VaultContentStore {
  put(workspaceId: string, itemId: string, revision: number, bytes: Buffer): Promise<VaultBlobPutResult>;
  get(locator: VaultStorageLocator): Promise<Buffer>;
  delete(locator: VaultStorageLocator): Promise<void>;
}

/**
 * Local development sandbox. Content is always under a configured root;
 * caller-supplied absolute paths are rejected.
 */
export class LocalSandboxContentStore implements VaultContentStore {
  constructor(private readonly rootDir: string) {
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  private resolveSafe(relativePath: string): string {
    if (path.isAbsolute(relativePath) || relativePath.includes('..') || relativePath.includes('\0')) {
      throw new Error('Refusing unsafe vault storage path');
    }
    const full = path.resolve(this.rootDir, relativePath);
    const root = path.resolve(this.rootDir);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error('Vault storage path escaped sandbox');
    }
    return full;
  }

  async put(
    workspaceId: string,
    itemId: string,
    revision: number,
    bytes: Buffer,
  ): Promise<VaultBlobPutResult> {
    const ws = workspaceId.trim().toLowerCase();
    const id = itemId.trim().toLowerCase();
    if (!ws || !id || ws.includes('..') || id.includes('..')) {
      throw new Error('Invalid workspace or item id for vault storage');
    }
    const relativePath = path.posix.join(ws, id, `r${revision}.bin`);
    const full = this.resolveSafe(relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, bytes);
    return {
      locator: { scheme: 'sandbox', relativePath },
      byteSize: bytes.byteLength,
      checksum: sha256Hex(bytes),
    };
  }

  async get(locator: VaultStorageLocator): Promise<Buffer> {
    if (locator.scheme !== 'sandbox') {
      throw new Error(`LocalSandboxContentStore cannot read scheme ${locator.scheme}`);
    }
    const full = this.resolveSafe(locator.relativePath);
    return fs.readFileSync(full);
  }

  async delete(locator: VaultStorageLocator): Promise<void> {
    if (locator.scheme !== 'sandbox') return;
    const full = this.resolveSafe(locator.relativePath);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }
}

/**
 * Production-shaped object storage adapter. Uses an in-memory map unless
 * DOCUMENT_VAULT_OBJECT_DIR is set (then files under that sandbox root).
 * Never accepts arbitrary user host paths as object keys.
 */
export class ObjectStorageContentStore implements VaultContentStore {
  private readonly memory = new Map<string, Buffer>();
  private readonly disk: LocalSandboxContentStore | null;

  constructor(
    private readonly bucket = process.env.DOCUMENT_VAULT_OBJECT_BUCKET?.trim() || 'carina-document-vault',
    objectDir = process.env.DOCUMENT_VAULT_OBJECT_DIR?.trim() || '',
  ) {
    this.disk = objectDir ? new LocalSandboxContentStore(objectDir) : null;
  }

  private keyFor(workspaceId: string, itemId: string, revision: number): string {
    const ws = workspaceId.trim().toLowerCase();
    const id = itemId.trim().toLowerCase();
    if (!ws || !id || ws.includes('/') || id.includes('/') || ws.includes('..') || id.includes('..')) {
      throw new Error('Invalid object key components');
    }
    return `${ws}/${id}/r${revision}`;
  }

  async put(
    workspaceId: string,
    itemId: string,
    revision: number,
    bytes: Buffer,
  ): Promise<VaultBlobPutResult> {
    const key = this.keyFor(workspaceId, itemId, revision);
    if (this.disk) {
      const put = await this.disk.put(workspaceId, itemId, revision, bytes);
      return {
        locator: { scheme: 'object', bucket: this.bucket, key },
        byteSize: put.byteSize,
        checksum: put.checksum,
      };
    }
    this.memory.set(`${this.bucket}:${key}`, bytes);
    return {
      locator: { scheme: 'object', bucket: this.bucket, key },
      byteSize: bytes.byteLength,
      checksum: sha256Hex(bytes),
    };
  }

  async get(locator: VaultStorageLocator): Promise<Buffer> {
    if (locator.scheme !== 'object') {
      throw new Error(`ObjectStorageContentStore cannot read scheme ${locator.scheme}`);
    }
    if (locator.bucket !== this.bucket) {
      throw new Error('Object bucket mismatch');
    }
    if (locator.key.includes('..') || path.isAbsolute(locator.key)) {
      throw new Error('Refusing unsafe object key');
    }
    if (this.disk) {
      const [ws, id, revFile] = locator.key.split('/');
      const rev = Number(String(revFile ?? '').replace(/^r/, '').replace(/\.bin$/, ''));
      return this.disk.get({
        scheme: 'sandbox',
        relativePath: path.posix.join(ws, id, `r${rev}.bin`),
      });
    }
    const bytes = this.memory.get(`${locator.bucket}:${locator.key}`);
    if (!bytes) throw new Error('Object not found');
    return bytes;
  }

  async delete(locator: VaultStorageLocator): Promise<void> {
    if (locator.scheme !== 'object') return;
    this.memory.delete(`${locator.bucket}:${locator.key}`);
    if (this.disk) {
      const [ws, id, revFile] = locator.key.split('/');
      const rev = Number(String(revFile ?? '').replace(/^r/, '').replace(/\.bin$/, ''));
      await this.disk.delete({
        scheme: 'sandbox',
        relativePath: path.posix.join(ws, id, `r${rev}.bin`),
      });
    }
  }
}

export function createDefaultContentStore(rootDir: string): VaultContentStore {
  const mode = (process.env.DOCUMENT_VAULT_STORAGE_MODE ?? 'sandbox').trim().toLowerCase();
  if (mode === 'object') return new ObjectStorageContentStore();
  return new LocalSandboxContentStore(rootDir);
}
