import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../memory/db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../config/index.js', () => ({
  config: { carina: { subagentMaxTurns: 5 } },
}));

const { runTurn, setProviderOverride } = vi.hoisted(() => ({
  runTurn: vi.fn(),
  setProviderOverride: vi.fn(),
}));

vi.mock('./carina.js', () => ({
  CarinaAgent: class {
    runTurn = runTurn;
    setProviderOverride = setProviderOverride;
  },
}));

vi.mock('./cron-workdir.js', () => ({
  resolveCronWorkdir: vi.fn(() => '/tmp/cron-work'),
}));

vi.mock('./cron-script-runner.js', () => ({
  runCronScriptFile: vi.fn(),
  injectScriptOutput: (prompt: string, output: string) => `${prompt}\n\nScript output:\n${output}`,
}));

import { runCronStep } from './cron-step-runner.js';
import { runCronScriptFile } from './cron-script-runner.js';

describe('cron-step-runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('noAgent job does not call the LLM', async () => {
    vi.mocked(runCronScriptFile).mockResolvedValue({
      stdout: 'health ok',
      stderr: '',
      exitCode: 0,
      durationMs: 5,
    });

    const result = await runCronStep({
      jobId: 'job-1',
      prompt: null,
      scriptPath: 'data/scripts/health.sh',
      noAgent: true,
      enabledToolsets: [],
      workdir: null,
    });

    expect(result).toEqual({ output: 'health ok', success: true });
    expect(runTurn).not.toHaveBeenCalled();
  });

  it('skipScript avoids running script file and uses prompt directly', async () => {
    runTurn.mockResolvedValue({ text: 'agent reply' });

    const result = await runCronStep({
      jobId: 'job-2',
      prompt: 'prebuilt prompt with script output already injected',
      scriptPath: 'data/scripts/ignored.sh',
      noAgent: false,
      enabledToolsets: [],
      workdir: null,
      skipScript: true,
    });

    expect(result.success).toBe(true);
    expect(runCronScriptFile).not.toHaveBeenCalled();
    expect(runTurn).toHaveBeenCalledWith('prebuilt prompt with script output already injected');
  });
});
