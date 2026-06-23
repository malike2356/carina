import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('ink onboarding persistence', () => {
  let tmpHome: string;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-ink-onboard-'));
    process.env.CARINA_HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('persists anthropic provider answers from ink onboarding state', async () => {
    const { persistInkOnboardingState } = await import('../tui/ink/onboarding/persist.js');
    await persistInkOnboardingState({
      step: 'done',
      provider: 'anthropic',
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-6',
      workspaceName: 'Property Ops',
      homeDir: tmpHome,
      personality: 'direct',
      tourChoice: 'no',
    });

    const env = await fs.readFile(path.join(tmpHome, '.env'), 'utf-8');
    expect(env).toContain('ANTHROPIC_API_KEY=sk-ant-test');
    expect(env).toContain('CARINA_ONBOARDING_DONE=true');
    expect(env).toContain('CARINA_OPERATOR_NAME=Property Ops');
    expect(env).toContain('CARINA_VOICE_PRESET=direct');

    const agents = JSON.parse(
      await fs.readFile(path.join(tmpHome, 'agents.json'), 'utf-8'),
    ) as { agents: Array<{ name: string }> };
    expect(agents.agents[0]?.name).toBe('Property Ops');
  });

  it('persists gemini provider via env keys', async () => {
    const { persistInkOnboardingState } = await import('../tui/ink/onboarding/persist.js');
    await persistInkOnboardingState({
      step: 'done',
      provider: 'gemini',
      apiKey: 'gem-test',
      model: 'gemini-2.0-flash',
      workspaceName: null,
      homeDir: tmpHome,
      personality: 'warm',
      tourChoice: 'later',
    });

    const env = await fs.readFile(path.join(tmpHome, '.env'), 'utf-8');
    expect(env).toContain('GEMINI_API_KEY=gem-test');
    expect(env).toContain('GEMINI_MODEL=gemini-2.0-flash');
    expect(env).toContain('CARINA_OPERATOR_NAME=Operator');
    expect(env).toContain('CARINA_TOUR_REMINDER=true');
  });

  it('seeds SOUL.md for direct personality preset', async () => {
    const { persistInkOnboardingState } = await import('../tui/ink/onboarding/persist.js');
    await persistInkOnboardingState({
      step: 'done',
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o',
      workspaceName: 'Test',
      homeDir: tmpHome,
      personality: 'direct',
      tourChoice: 'no',
    });

    const soul = await fs.readFile(
      path.join(tmpHome, 'workspaces', 'main', 'SOUL.md'),
      'utf-8',
    );
    expect(soul).toContain('Be direct and concise');
  });
});

describe('onboarding chrome', () => {
  it('builds a ten-slot progress bar string', async () => {
    const { renderProgressBar } = await import('../tui/ink/onboarding/components/progress-bar.js');
    expect(renderProgressBar(1, 6)).toBe('██░░░░░░░░');
    expect(renderProgressBar(6, 6)).toBe('██████████');
  });
});

describe('provider bootstrap helpers', () => {
  it('detects gemini and groq keys in env file contents', async () => {
    const { hasLlmApiKeyInEnvContents } = await import('./provider-bootstrap.js');
    expect(hasLlmApiKeyInEnvContents('GEMINI_API_KEY=abc\n')).toBe(true);
    expect(hasLlmApiKeyInEnvContents('GROQ_API_KEY=abc\n')).toBe(true);
  });
});
