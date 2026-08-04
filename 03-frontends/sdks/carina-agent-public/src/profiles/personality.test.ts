import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  loadProfilePersonality,
  personalityToSystemSuffix,
} from './personality.js';

describe('profile personality', () => {
  let tmpRoot = '';

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-profile-'));
    process.env.CARINA_PROFILES_DIR = tmpRoot;
    process.env.CARINA_HOME = path.join(tmpRoot, 'home');
    await fs.mkdir(process.env.CARINA_HOME, { recursive: true });
    await fs.mkdir(path.join(tmpRoot, 'work'), { recursive: true });
    await fs.writeFile(path.join(process.env.CARINA_HOME, 'active-profile'), 'work');
    await fs.mkdir(path.join(tmpRoot, 'work'), { recursive: true });
  });

  afterEach(async () => {
    delete process.env.CARINA_PROFILES_DIR;
    delete process.env.CARINA_HOME;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('loads personality.md', async () => {
    await fs.writeFile(path.join(tmpRoot, 'work', 'personality.md'), `# analyst
tone: analytical and brief
traits: precise, skeptical

Always cite evidence.`, 'utf8');
    const p = await loadProfilePersonality('work');
    expect(p.name).toBe('analyst');
    expect(p.traits).toContain('precise');
    expect(personalityToSystemSuffix(p)).toContain('analyst');
  });

  it('loads personality.yaml', async () => {
    await fs.writeFile(path.join(tmpRoot, 'work', 'personality.yaml'), `name: coach
tone: encouraging
traits: [warm, direct]
instructions: Ask one clarifying question before acting.`, 'utf8');
    const p = await loadProfilePersonality('work');
    expect(p.name).toBe('coach');
    expect(p.instructions).toContain('clarifying');
  });

  it('returns default when no personality file', async () => {
    const p = await loadProfilePersonality('work');
    expect(p.source).toBe('default');
    expect(personalityToSystemSuffix(p)).toBe('');
  });
});
