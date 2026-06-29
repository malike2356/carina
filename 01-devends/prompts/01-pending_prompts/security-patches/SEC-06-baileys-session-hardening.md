# SEC-06: Baileys Session Key Hardening

**Severity:** High
**Status:** Unpatched - WhatsApp session credentials stored in plaintext on disk
**Affects:** core.carinaai.uk src/gateway/ (WhatsApp/Baileys channel adapter)

## Problem

Baileys (`@whiskeysockets/baileys 7.0.0-rc13`) stores WhatsApp session credentials
in a local directory (`auth_info_baileys/` by default). These credentials contain:
- The device long-term private key (used to authenticate the device to WhatsApp)
- Pre-keys and signed pre-keys (used for Signal Protocol sessions)
- Session keys for active conversations

If the VPS is compromised, an attacker who reads this directory can:
1. Impersonate the WhatsApp account from any device
2. Read message history
3. Send messages as the business

Unlike a password, WhatsApp session keys cannot be rotated by changing a config.
Compromise requires unlinking the device from WhatsApp entirely and re-linking.

## Files to Patch

Find the Baileys adapter:
```bash
find 02-backends/core.carinaai.uk/src/gateway -name "*.ts" | xargs grep -l "baileys\|makeWASocket\|useMultiFileAuthState"
```

## New File: src/gateway/whatsapp/session-store.ts

This replaces Baileys' default plaintext `useMultiFileAuthState` with an
AES-256-GCM encrypted store backed by the filesystem.

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import type { AuthenticationCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';

const ALGO = 'aes-256-gcm' as const;
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT_LEN = 32;
const KEY_LEN = 32;

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

function encrypt(plaintext: Buffer, secret: string): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(secret, salt);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: [SALT_LEN][IV_LEN][TAG_LEN][ciphertext]
  return Buffer.concat([salt, iv, tag, ciphertext]);
}

function decrypt(blob: Buffer, secret: string): Buffer {
  const salt = blob.subarray(0, SALT_LEN);
  const iv = blob.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = blob.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const ciphertext = blob.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
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
  state: { creds: AuthenticationCreds; keys: SignalDataTypeMap };
  saveCreds: () => Promise<void>;
}> {
  await mkdir(folder, { recursive: true });

  const credsPath = join(folder, 'creds.enc');

  async function readCreds(): Promise<AuthenticationCreds | null> {
    const raw = await readEncrypted(credsPath, secret);
    if (!raw) return null;
    try {
      return JSON.parse(raw.toString('utf8')) as AuthenticationCreds;
    } catch {
      return null;
    }
  }

  async function writeCreds(creds: AuthenticationCreds): Promise<void> {
    await writeEncrypted(credsPath, Buffer.from(JSON.stringify(creds)), secret);
  }

  const { initAuthCreds } = await import('@whiskeysockets/baileys');
  let creds: AuthenticationCreds = (await readCreds()) ?? initAuthCreds();

  const keys: SignalDataTypeMap = {} as SignalDataTypeMap;

  return {
    state: { creds, keys },
    saveCreds: () => writeCreds(creds),
  };
}
```

## Changes to the Baileys Adapter

Find the adapter file and replace the useMultiFileAuthState call:

```typescript
// BEFORE:
const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

// AFTER:
import { useEncryptedAuthState } from './session-store.js';

const sessionSecret = process.env.CARINA_WHATSAPP_SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    'CARINA_WHATSAPP_SESSION_SECRET must be set and at least 32 characters. ' +
    'Generate with: openssl rand -base64 32'
  );
}
const { state, saveCreds } = await useEncryptedAuthState(sessionDir, sessionSecret);
```

## Environment Variable

Add to `.env.production.example`:
```bash
# WhatsApp session encryption key - REQUIRED if WhatsApp channel is enabled.
# Generate with: openssl rand -base64 32
# CRITICAL: Back this up. If lost, you must re-link all WhatsApp accounts.
# CRITICAL: Rotate if the VPS is compromised.
CARINA_WHATSAPP_SESSION_SECRET=
```

## Per-Account Isolation

Each WhatsApp account (each `accountId`) must use a different session directory:

```typescript
const sessionDir = join(config.paths.data, 'whatsapp', accountId, 'session');
```

Never share a session directory between two accounts. This limits the blast radius
if one account is compromised: the attacker cannot pivot to other accounts by
reading a shared directory.

## Revocation Monitoring

Add a check when the Baileys socket emits `connection.update`:

```typescript
sock.ev.on('connection.update', async (update) => {
  if (update.connection === 'close') {
    const reason = (update.lastDisconnect?.error as any)?.output?.statusCode;
    if (reason === DisconnectReason.loggedOut) {
      // Session was revoked from WhatsApp (user manually removed device)
      await reportSecurityEvent('whatsapp_session_revoked', 'critical', {
        accountId,
        reason,
      });
      // Delete the local session file - it is now invalid
      try {
        await unlink(join(sessionDir, 'creds.enc'));
      } catch {}
    }
  }
});
```

## Migration: Encrypting Existing Sessions

If there are existing plaintext sessions in `auth_info_baileys/`, run this
one-time migration BEFORE deploying the new adapter code:

```bash
node -e "
const { readFileSync, writeFileSync, readdirSync } = require('fs');
// ... migration script that reads each .json and writes encrypted equivalent ...
// See SEC-06-migrate.js in this directory for the full migration script.
"
```

After migrating, delete the original `.json` files and verify the adapter still
connects successfully.

## Verification

```bash
# Confirm no plaintext creds files exist after migration
find /opt/lampp/htdocs/verlox/carina/carina_aiva/02-backends/core.carinaai.uk/data \
  -name "creds.json" -o -name "auth_info_baileys" -type d
# Should return nothing

# Confirm encrypted files exist
find /opt/lampp/htdocs/verlox/carina/carina_aiva/02-backends/core.carinaai.uk/data \
  -name "*.enc"
# Should show creds.enc for each linked WhatsApp account

# Confirm file permissions are 0600
stat -c "%a %n" \
  /opt/lampp/htdocs/verlox/carina/carina_aiva/02-backends/core.carinaai.uk/data/whatsapp/*/session/creds.enc
# Should show 600 for all files
```
