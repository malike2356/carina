import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const curateMock = vi.hoisted(() => vi.fn().mockResolvedValue({ action: 'created', skill: 'test' }));

vi.mock('./curator.js', () => ({
  curateFromWorkflow: curateMock,
}));

import { learnFromSessionTurn } from './session-learner.js';

describe('session-learner', () => {
  beforeEach(() => {
    curateMock.mockClear();
    process.env.CARINA_AUTO_SKILL_LEARN = 'true';
  });

  afterEach(() => {
    delete process.env.CARINA_AUTO_SKILL_LEARN;
  });

  it('skips when fewer than 2 tools used', async () => {
    await learnFromSessionTurn({
      userMessage: 'hello',
      assistantText: 'a'.repeat(100),
      toolsUsed: ['file-read'],
      toolCallLog: [],
    });
    expect(curateMock).not.toHaveBeenCalled();
  });

  it('curates when multiple tools used', async () => {
    await learnFromSessionTurn({
      userMessage: 'deploy the app to staging',
      assistantText: 'Done. I built and deployed the app successfully with all tests passing and verified the staging endpoint responds correctly.',
      toolsUsed: ['shell-exec', 'file-read'],
      toolCallLog: ['shell-exec: {"cmd":"pnpm build"}'],
    });
    expect(curateMock).toHaveBeenCalledOnce();
  });
});
