import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('first-run bootstrap', () => {
  let tmpHome: string;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-first-run-'));
    process.env.CARINA_HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('writes minimal env and config without API keys', async () => {
    const { writeMinimalBootstrap } = await import('./first-run.js');
    await writeMinimalBootstrap();

    const envPath = path.join(tmpHome, '.env');
    const configPath = path.join(tmpHome, 'config.yaml');
    const env = await fs.readFile(envPath, 'utf-8');
    expect(env).toContain('CARINA_LOCAL_MODE=true');
    expect(env).not.toMatch(/^DEEPSEEK_API_KEY=\S/m);
    await expect(fs.access(configPath)).resolves.toBeUndefined();
  });

  it('detects when onboarding is already complete', async () => {
    const envPath = path.join(tmpHome, '.env');
    await fs.writeFile(
      envPath,
      [
        'CARINA_OPERATOR_NAME=Alex',
        'CARINA_ONBOARDING_DONE=true',
        'DEEPSEEK_API_KEY=sk-test',
      ].join('\n') + '\n',
    );

    const { needsFirstRunOnboarding } = await import('./first-run.js');
    await expect(needsFirstRunOnboarding()).resolves.toBe(false);
  });

  it('detects partial install missing profile', async () => {
    const envPath = path.join(tmpHome, '.env');
    await fs.writeFile(envPath, 'DEEPSEEK_API_KEY=sk-test\n');

    const { assessFirstRunGaps } = await import('./first-run-onboarding.js');
    const gaps = await assessFirstRunGaps(envPath);
    expect(gaps.needsProfile).toBe(true);
    expect(gaps.needsProvider).toBe(false);
  });

  it('skips bootstrap when ops PTY inherits core env with API keys', async () => {
    const coreDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-core-env-'));
    await fs.writeFile(path.join(coreDir, '.env'), 'DEEPSEEK_API_KEY=sk-test\n');
    process.env.CARINA_OPS_PTY = '1';
    const prevCwd = process.cwd();
    process.chdir(coreDir);

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { ensureFirstRunReady } = await import('./first-run.js');
    await ensureFirstRunReady();

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Non-interactive first run'));
    logSpy.mockRestore();
    process.chdir(prevCwd);
    delete process.env.CARINA_OPS_PTY;
    await fs.rm(coreDir, { recursive: true, force: true });
  });
});

describe('first-run onboarding persistence', () => {
  let tmpHome: string;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-onboard-'));
    process.env.CARINA_HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('persists profile and provider answers to env and config', async () => {
    const { persistFirstRunAnswers } = await import('./first-run-onboarding.js');
    await persistFirstRunAnswers({
      operatorName: 'Sam',
      operatorContext: 'A property sourcing tool',
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'sk-test-key',
      configureLater: false,
    });

    const env = await fs.readFile(path.join(tmpHome, '.env'), 'utf-8');
    expect(env).toContain('CARINA_OPERATOR_NAME=Sam');
    expect(env).toContain('CARINA_OPERATOR_CONTEXT=A property sourcing tool');
    expect(env).toContain('DEEPSEEK_API_KEY=sk-test-key');
    expect(env).toContain('CARINA_ONBOARDING_DONE=true');

    const config = await fs.readFile(path.join(tmpHome, 'config.yaml'), 'utf-8');
    expect(config).toContain('deepseek');
  });

  it('persists local mode when user defers provider setup', async () => {
    const { persistFirstRunAnswers } = await import('./first-run-onboarding.js');
    await persistFirstRunAnswers({
      operatorName: 'Jordan',
      operatorContext: '',
      configureLater: true,
    });

    const env = await fs.readFile(path.join(tmpHome, '.env'), 'utf-8');
    expect(env).toContain('CARINA_OPERATOR_NAME=Jordan');
    expect(env).toContain('CARINA_LOCAL_MODE=true');
    expect(env).toContain('CARINA_ONBOARDING_DONE=true');
    expect(env).not.toMatch(/^DEEPSEEK_API_KEY=\S/m);

    const userPath = path.join(tmpHome, 'workspaces', 'main', 'USER.md');
    const userMd = await fs.readFile(userPath, 'utf-8');
    expect(userMd).toContain('**Name:** Jordan');
  });
});

describe('first-run onboarding prompts', () => {
  let tmpHome: string;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-onboard-prompts-'));
    process.env.CARINA_HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('asks name, context, and provider when starting fresh', async () => {
    const input = vi.fn()
      .mockResolvedValueOnce('Riley')
      .mockResolvedValueOnce('An agent marketplace')
      .mockResolvedValueOnce('deepseek-chat');
    const select = vi.fn()
      .mockResolvedValueOnce('now')
      .mockResolvedValueOnce('deepseek');
    const password = vi.fn().mockResolvedValue('sk-live');
    const confirm = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    const { runFirstRunOnboarding } = await import('./first-run-onboarding.js');
    const ran = await runFirstRunOnboarding({ input, select, password, confirm });
    expect(ran).toBe(true);
    expect(input).toHaveBeenCalledTimes(3);
    expect(select).toHaveBeenCalledTimes(2);
    expect(password).toHaveBeenCalledTimes(1);

    const env = await fs.readFile(path.join(tmpHome, '.env'), 'utf-8');
    expect(env).toContain('CARINA_OPERATOR_NAME=Riley');
    expect(env).toContain('DEEPSEEK_API_KEY=sk-live');
  });

  it('skips onboarding when profile and provider already exist', async () => {
    await fs.writeFile(
      path.join(tmpHome, '.env'),
      [
        'CARINA_OPERATOR_NAME=Existing',
        'CARINA_ONBOARDING_DONE=true',
        'DEEPSEEK_API_KEY=sk-test',
      ].join('\n') + '\n',
    );

    const input = vi.fn();
    const { runFirstRunOnboarding } = await import('./first-run-onboarding.js');
    const ran = await runFirstRunOnboarding({
      input,
      select: vi.fn(),
      password: vi.fn(),
      confirm: vi.fn(),
    });
    expect(ran).toBe(false);
    expect(input).not.toHaveBeenCalled();
  });
});

describe('provider bootstrap helpers', () => {
  it('detects LLM keys in env file contents', async () => {
    const { hasLlmApiKeyInEnvContents } = await import('./provider-bootstrap.js');
    expect(hasLlmApiKeyInEnvContents('DEFAULT_PROVIDER=deepseek\n')).toBe(false);
    expect(hasLlmApiKeyInEnvContents('OPENAI_API_KEY=sk-abc\n')).toBe(true);
  });
});
