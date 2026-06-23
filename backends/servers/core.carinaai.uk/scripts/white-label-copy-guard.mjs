#!/usr/bin/env node
/**
 * Release guard: customer-facing chat copy must stay brand-parameterised.
 * Fails when hardcoded platform agent names leak into i18n chat strings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');
const appRoot = path.join(repoRoot, 'frontends/client-apps/app.carinaai.uk');
const localesDir = path.join(appRoot, 'src/i18n/locales');
const chatInputBarPath = path.join(appRoot, 'src/components/chat/ChatInputBar.tsx');

const CHAT_KEYS = ['placeholder', 'approvalRequest', 'heartbeat', 'empty'];
const failures = [];

function fail(message) {
  failures.push(message);
}

function readLocaleChat(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const chatBlock = text.match(/chat:\s*\{([\s\S]*?)\n\s*\},/);
  if (!chatBlock) {
    fail(`Missing chat block in ${path.relative(repoRoot, filePath)}`);
    return {};
  }
  const entries = {};
  for (const key of CHAT_KEYS) {
    const match = chatBlock[1].match(new RegExp(`${key}:\\s*'([^']*)'`));
    if (match) entries[key] = match[1];
  }
  return entries;
}

if (!fs.existsSync(localesDir)) {
  console.error(`Locales directory not found: ${localesDir}`);
  process.exit(1);
}

const enPath = path.join(localesDir, 'en.ts');
const enChat = readLocaleChat(enPath);
for (const key of CHAT_KEYS) {
  const value = enChat[key];
  if (!value) {
    fail(`en.ts missing chat.${key}`);
    continue;
  }
  if (value.includes('Carina')) {
    fail(`en.ts chat.${key} contains hardcoded Carina: ${value}`);
  }
  if (key !== 'empty' && !value.includes('{agentName}')) {
    fail(`en.ts chat.${key} must include {agentName}: ${value}`);
  }
}

for (const file of fs.readdirSync(localesDir).filter((name) => name.endsWith('.ts') && name !== 'en.ts')) {
  const filePath = path.join(localesDir, file);
  const chat = readLocaleChat(filePath);
  const placeholder = chat.placeholder;
  if (!placeholder) continue;
  if (placeholder.includes('Carina')) {
    fail(`${file} chat.placeholder contains hardcoded Carina: ${placeholder}`);
  }
  if (!placeholder.includes('{agentName}')) {
    fail(`${file} chat.placeholder must include {agentName}: ${placeholder}`);
  }
}

if (fs.existsSync(chatInputBarPath)) {
  const chatInput = fs.readFileSync(chatInputBarPath, 'utf8');
  if (!chatInput.includes('useBrandedTranslation')) {
    fail('ChatInputBar.tsx must use useBrandedTranslation for chat.placeholder');
  }
} else {
  fail('ChatInputBar.tsx not found');
}

if (failures.length > 0) {
  console.error('White-label copy guard failed:');
  for (const line of failures) console.error(`- ${line}`);
  process.exit(1);
}

console.log('White-label copy guard OK: chat i18n uses {agentName} and ChatInputBar is branded.');
