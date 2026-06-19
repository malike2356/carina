import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listPresentSystemPromptFiles,
  readSystemPromptFile,
  systemPromptFilesDir,
} from './system-prompt-files.js';

describe('system-prompt-files', () => {
  let tmpHome = '';

  afterEach(() => {
    if (tmpHome && fs.existsSync(tmpHome)) {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
    tmpHome = '';
  });

  it('reads overlays from ~/.carina/system', () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-system-'));
    const dir = systemPromptFilesDir(tmpHome);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'tool_enforcement.md'), 'Custom tool enforcement');
    fs.writeFileSync(path.join(dir, 'feature_guidance.md'), 'Custom feature guidance');

    expect(readSystemPromptFile('tool_enforcement', tmpHome)).toBe('Custom tool enforcement');
    expect(readSystemPromptFile('feature_guidance', tmpHome)).toBe('Custom feature guidance');
    expect(listPresentSystemPromptFiles(tmpHome)).toEqual(['tool_enforcement', 'feature_guidance']);
  });
});
