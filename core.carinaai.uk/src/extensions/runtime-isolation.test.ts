import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, '..');

const HOT_RUNTIME_PATHS = [
  'agents/orchestrator.ts',
  'index.ts',
].map((p) => path.join(srcRoot, p));

describe('extension runtime isolation', () => {
  it('hot runtime paths do not import extension manager or installer', async () => {
    for (const filePath of HOT_RUNTIME_PATHS) {
      const source = await fs.readFile(filePath, 'utf8');
      expect(source).not.toMatch(/extensions\/manager/);
      expect(source).not.toMatch(/extensions\/installer/);
      expect(source).not.toMatch(/extensions-cli/);
    }
  });

  it('extensions are opt-in via CARINA_EXTENSIONS_ENABLED', async () => {
    const skillsIndex = await fs.readFile(path.join(srcRoot, 'skills', 'index.ts'), 'utf8');
    expect(skillsIndex).toMatch(/CARINA_EXTENSIONS_ENABLED/);
    expect(skillsIndex).toMatch(/await import\('\.\.\/extensions\/contributions\.js'\)/);
  });

  it('system prompt reads cached extension suffix without importing manager', async () => {
    const source = await fs.readFile(path.join(srcRoot, 'agents', 'system-prompt.ts'), 'utf8');
    expect(source).toMatch(/getExtensionPromptSuffix/);
    expect(source).not.toMatch(/extensions\/manager/);
  });

  it('contributions module does not import orchestrator', async () => {
    const source = await fs.readFile(path.join(__dirname, 'contributions.ts'), 'utf8');
    expect(source).not.toMatch(/orchestrator/);
    expect(source).not.toMatch(/agents\/carina/);
  });

  it('plugin-sdk does not import extension manager or installer', async () => {
    const sdkDir = path.join(srcRoot, 'plugin-sdk');
    const files = await fs.readdir(sdkDir);
    for (const file of files.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const source = await fs.readFile(path.join(sdkDir, file), 'utf8');
      expect(source).not.toMatch(/extensions\/manager/);
      expect(source).not.toMatch(/extensions\/installer/);
      expect(source).not.toMatch(/agents\/carina/);
    }
  });
});
