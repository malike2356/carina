#!/usr/bin/env node
/**
 * One-time migration: encrypt plaintext Baileys auth JSON files to .enc blobs.
 *
 * Usage:
 *   CARINA_WHATSAPP_SESSION_SECRET="$(openssl rand -base64 32)" \
 *     node SEC-06-migrate.js /path/to/session/dir
 *
 * Add --delete-plaintext to remove .json files after successful encryption.
 */
import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import { readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;
const SALT_LEN = 32;
const KEY_LEN = 32;

function deriveKey(secret, salt) {
  return scryptSync(secret, salt, KEY_LEN, { N: 16384, r: 8, p: 1 });
}

function encrypt(plaintext, secret) {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(secret, salt);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, ciphertext]);
}

async function main() {
  const args = process.argv.slice(2);
  const deletePlaintext = args.includes('--delete-plaintext');
  const folder = args.find((arg) => !arg.startsWith('--'));

  if (!folder) {
    console.error('Usage: node SEC-06-migrate.js [--delete-plaintext] /path/to/session/dir');
    process.exit(1);
  }

  const secret = process.env.CARINA_WHATSAPP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    console.error('CARINA_WHATSAPP_SESSION_SECRET must be set and at least 32 characters.');
    process.exit(1);
  }

  const info = await stat(folder).catch(() => null);
  if (!info?.isDirectory()) {
    console.error(`Not a directory: ${folder}`);
    process.exit(1);
  }

  const files = (await readdir(folder)).filter((name) => name.endsWith('.json'));
  if (files.length === 0) {
    console.log('No plaintext .json auth files found.');
    return;
  }

  for (const name of files) {
    const jsonPath = join(folder, name);
    const encPath = join(folder, name.replace(/\.json$/, '.enc'));
    const raw = await readFile(jsonPath);
    await writeFile(encPath, encrypt(raw, secret), { mode: 0o600 });
    console.log(`Encrypted ${name} -> ${name.replace(/\.json$/, '.enc')}`);
    if (deletePlaintext) {
      await unlink(jsonPath);
      console.log(`Deleted ${name}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
