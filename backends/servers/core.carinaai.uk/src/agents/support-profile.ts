import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_PROFILE_IDS } from '../profiles/profile-ids.js';
import { createProfile, describeProfile, listProfiles } from '../profiles/manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = path.resolve(__dirname, '../..');
const SUPPORT_BRAIN_DIR = path.join(CORE_ROOT, 'brain', 'carina_support_knowledge');
const SUPPORT_SYSTEM_PROMPT_PATH = path.join(SUPPORT_BRAIN_DIR, 'system-prompt.md');
const SUPPORT_KNOWLEDGE_DIR = path.join(SUPPORT_BRAIN_DIR, 'knowledge');

export const SUPPORT_PROFILE_ID = BUILTIN_PROFILE_IDS.support;
export const SUPPORT_PROFILE_NAME = 'Support';
export const SUPPORT_KNOWLEDGE_PACK = 'carina_support_knowledge';

export function supportSystemPromptPath(): string {
  return SUPPORT_SYSTEM_PROMPT_PATH;
}

export function supportKnowledgeDir(): string {
  return SUPPORT_KNOWLEDGE_DIR;
}

export function loadSupportSystemPrompt(): string {
  if (!fs.existsSync(SUPPORT_SYSTEM_PROMPT_PATH)) {
    throw new Error(`Support system prompt not found: ${SUPPORT_SYSTEM_PROMPT_PATH}`);
  }
  const content = fs.readFileSync(SUPPORT_SYSTEM_PROMPT_PATH, 'utf8').trim();
  if (!content) {
    throw new Error('Support system prompt is empty');
  }
  return content;
}

export async function ensureSupportFilesystemProfile(): Promise<void> {
  const profiles = await listProfiles();
  const profileDir = describeProfile(SUPPORT_PROFILE_ID).dir;
  const exists = profiles.includes(SUPPORT_PROFILE_ID) && fs.existsSync(profileDir);

  if (!exists) {
    await createProfile(SUPPORT_PROFILE_ID);
  }

  const prompt = loadSupportSystemPrompt();
  const personalityPath = path.join(profileDir, 'personality.md');
  const personality = `# ${SUPPORT_PROFILE_NAME}
tone: warm, clear, and efficient
traits: helpful, honest, plain-spoken

${prompt}
`;
  await fsPromises.writeFile(personalityPath, personality, 'utf8');
}
