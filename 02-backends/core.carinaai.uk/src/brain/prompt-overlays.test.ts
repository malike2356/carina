import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildModelFamilyOverlay, resolveModelFamily } from './prompt-overlays.js';

describe('model-family prompt overlays', () => {
  afterEach(() => {
    delete process.env.CARINA_HOME;
    vi.resetModules();
  });

  it('resolves anthropic family from provider kind', () => {
    expect(resolveModelFamily('anthropic', 'claude-sonnet-4-20250514')).toBe('anthropic');
  });

  it('resolves reasoning family for premium models', () => {
    expect(resolveModelFamily('openai', 'o3-mini')).toBe('reasoning');
  });

  it('builds overlay text for gemini', () => {
    const overlay = buildModelFamilyOverlay('gemini', 'gemini-2.0-flash');
    expect(overlay).toContain('Model-family guidance (gemini)');
    expect(overlay).toContain('tool schemas');
  });

  it('adds anti-hallucination guidance for deepseek', () => {
    const overlay = buildModelFamilyOverlay('deepseek', 'deepseek-chat');
    expect(overlay).toContain('Do not hallucinate file contents');
    expect(overlay).toContain('verify deliverables before declaring DONE');
  });

  it('adds tool persistence guidance for openai-compatible models', () => {
    const overlay = buildModelFamilyOverlay('openai', 'gpt-4o');
    expect(overlay).toContain('retry on empty or partial tool output');
  });

  it('loads provider overlays from CARINA_HOME', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-overlay-'));
    process.env.CARINA_HOME = home;
    fs.mkdirSync(path.join(home, 'overlays'), { recursive: true });
    fs.writeFileSync(
      path.join(home, 'overlays', 'openai.md'),
      'Provider-specific guidance\n- keep responses short',
      'utf8',
    );

    vi.resetModules();
    const { buildModelFamilyOverlay: buildOverlay } = await import('./prompt-overlays.js');
    const overlay = buildOverlay('openai', 'gpt-4o');
    expect(overlay).toContain('Provider overlay (openai)');
    expect(overlay).toContain('Provider-specific guidance');
    expect(overlay).toContain('Model-family guidance (openai)');
  });
});
