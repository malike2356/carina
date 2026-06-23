import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SUPPORT_KNOWLEDGE_PACK,
  SUPPORT_PROFILE_ID,
  loadSupportSystemPrompt,
  supportKnowledgeDir,
  supportSystemPromptPath,
} from './support-profile.js';

describe('support-profile', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exposes the support builtin profile id and pack name', () => {
    expect(SUPPORT_PROFILE_ID).toBe('support');
    expect(SUPPORT_KNOWLEDGE_PACK).toBe('carina_support_knowledge');
  });

  it('loads the deployed support system prompt from the brain pack', () => {
    const prompt = loadSupportSystemPrompt();
    expect(prompt).toContain('You are Carina, the built-in support assistant');
    expect(prompt).toContain('Product knowledge reference');
    expect(prompt).toContain('What is BYOK');
    expect(fs.existsSync(supportSystemPromptPath())).toBe(true);
    expect(fs.existsSync(path.join(supportKnowledgeDir(), '01-product-overview.md'))).toBe(true);
  });

  it('ensureSupportFilesystemProfile writes personality.md for the support profile', async () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-support-profile-'));
    const profilesRoot = path.join(tmpHome, 'profiles');
    vi.stubEnv('CARINA_PROFILES_DIR', profilesRoot);
    vi.stubEnv('CARINA_HOME', tmpHome);

    const { ensureSupportFilesystemProfile } = await import('./support-profile.js');
    await ensureSupportFilesystemProfile();

    const personalityPath = path.join(profilesRoot, 'support', 'personality.md');
    expect(fs.existsSync(personalityPath)).toBe(true);
    const personality = fs.readFileSync(personalityPath, 'utf8');
    expect(personality).toContain('You are Carina, the built-in support assistant');
  });
});
