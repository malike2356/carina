import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import type { AuthenticationCreds, SignalDataSet, SignalDataTypeMap, SignalKeyStore } from '@whiskeysockets/baileys';

const ALGO = 'aes-256-gcm' as const;
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT_LEN = 32;
const KEY_LEN = 32;

class FileMutex {
  private locked = false;
  private queue: Array<() => void> = [];

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
        return;
      }
      this.queue.push(resolve);
    });
    try {
      return await fn();
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.locked = false;
    }
  }
}

const fileLocks = new Map<string, FileMutex>();

function getFileLock(filePath: string): FileMutex {
  let mutex = fileLocks.get(filePath);
  if (!mutex) {
    mutex = new FileMutex();
    fileLocks.set(filePath, mutex);
  }
  return mutex;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

export function encrypt(plaintext: Buffer, secret: string): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(secret, salt);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, ciphertext]);
}

export function decrypt(blob: Buffer, secret: string): Buffer {
  const salt = blob.subarray(0, SALT_LEN);
  const iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = blob.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = blob.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function fixFileName(file: string): string {
  return file.replace(/\//g, '__').replace(/:/g, '-');
}

function jsonToEncName(jsonName: string): string {
  return jsonName.endsWith('.json') ? jsonName.replace(/\.json$/, '.enc') : `${jsonName}.enc`;
}

export function requireSessionSecret(): string {
  const secret = process.env.CARINA_WHATSAPP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'CARINA_WHATSAPP_SESSION_SECRET must be set and at least 32 characters. '
      + 'Generate with: openssl rand -base64 32',
    );
  }
  return secret;
}

async function readEncrypted(filePath: string, secret: string): Promise<Buffer | null> {
  try {
    const blob = await readFile(filePath);
    return decrypt(blob, secret);
  } catch {
    return null;
  }
}

async function writeEncrypted(filePath: string, data: Buffer, secret: string): Promise<void> {
  await writeFile(filePath, encrypt(data, secret), { mode: 0o600 });
}

export async function useEncryptedAuthState(
  folder: string,
  secret: string,
): Promise<{
  state: { creds: AuthenticationCreds; keys: SignalKeyStore };
  saveCreds: () => Promise<void>;
}> {
  const { initAuthCreds, BufferJSON, proto } = await import('@whiskeysockets/baileys');

  const writeData = async (data: unknown, file: string): Promise<void> => {
    const encName = jsonToEncName(fixFileName(file));
    const filePath = join(folder, encName);
    const mutex = getFileLock(filePath);
    await mutex.runExclusive(async () => {
      const payload = Buffer.from(JSON.stringify(data, BufferJSON.replacer), 'utf8');
      await writeEncrypted(filePath, payload, secret);
    });
  };

  const readData = async (file: string): Promise<unknown | null> => {
    const safeName = fixFileName(file);
    const encPath = join(folder, jsonToEncName(safeName));
    const plainPath = join(folder, safeName);

    const mutex = getFileLock(encPath);
    return mutex.runExclusive(async () => {
      const encrypted = await readEncrypted(encPath, secret);
      if (encrypted) {
        try {
          return JSON.parse(encrypted.toString('utf8'), BufferJSON.reviver);
        } catch {
          return null;
        }
      }

      try {
        const legacy = await readFile(plainPath, { encoding: 'utf-8' });
        const parsed = JSON.parse(legacy, BufferJSON.reviver);
        await writeEncrypted(
          encPath,
          Buffer.from(JSON.stringify(parsed, BufferJSON.replacer), 'utf8'),
          secret,
        );
        await unlink(plainPath).catch(() => undefined);
        return parsed;
      } catch {
        return null;
      }
    });
  };

  const removeData = async (file: string): Promise<void> => {
    const safeName = fixFileName(file);
    const encPath = join(folder, jsonToEncName(safeName));
    const plainPath = join(folder, safeName);
    const mutex = getFileLock(encPath);
    await mutex.runExclusive(async () => {
      await unlink(encPath).catch(() => undefined);
      await unlink(plainPath).catch(() => undefined);
    });
  };

  const folderInfo = await stat(folder).catch(() => undefined);
  if (folderInfo) {
    if (!folderInfo.isDirectory()) {
      throw new Error(`found something that is not a directory at ${folder}, either delete it or specify a different location`);
    }
  } else {
    await mkdir(folder, { recursive: true, mode: 0o700 });
  }

  const creds = (await readData('creds.json') as AuthenticationCreds | null) ?? initAuthCreds();

  const keys: SignalKeyStore = {
    get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
      const data = {} as { [id: string]: SignalDataTypeMap[T] };
      await Promise.all(ids.map(async (id) => {
        let value = await readData(`${String(type)}-${id}.json`);
        if (type === 'app-state-sync-key' && value) {
          value = proto.Message.AppStateSyncKeyData.fromObject(value);
        }
        data[id] = value as SignalDataTypeMap[T];
      }));
      return data;
    },
    set: async (data: SignalDataSet) => {
      const tasks: Array<Promise<void>> = [];
      for (const category in data) {
        const typedCategory = category as keyof SignalDataTypeMap;
        const bucket = data[typedCategory];
        if (!bucket) continue;
        for (const id in bucket) {
          const value = bucket[id];
          const file = `${String(typedCategory)}-${id}.json`;
          tasks.push(value ? writeData(value, file) : removeData(file));
        }
      }
      await Promise.all(tasks);
    },
  };

  return {
    state: {
      creds,
      keys,
    },
    saveCreds: async () => writeData(creds, 'creds.json'),
  };
}
