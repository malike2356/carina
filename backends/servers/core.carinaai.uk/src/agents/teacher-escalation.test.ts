import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  evaluateTurnRegex,
  parseTeacherSkillDraft,
  persistTeacherSkill,
  teacherEscalationEnabled,
  shouldEscalateStudentProvider,
} from './teacher-escalation.js';

const chatMock = vi.fn();

vi.mock('../brain/llm.js', () => ({
  llm: {
    chat: (...args: unknown[]) => chatMock(...args),
    list: () => ['anthropic', 'deepseek', 'ollama'],
    current: () => ({ name: 'deepseek' }),
  },
}));

describe('teacher-escalation', () => {
  beforeEach(() => {
    chatMock.mockReset();
    delete process.env.CARINA_TEACHER_ESCALATION;
    delete process.env.CARINA_TEACHER_PROVIDER;
  });

  it('detects tool errors and give-up replies', () => {
    expect(evaluateTurnRegex([{ error: 'Failed to open file' }], 'Done.')).toEqual({
      status: 'failure',
      reason: expect.stringContaining('tool returned error'),
    });
    expect(evaluateTurnRegex([], "I don't have a tool for that.")).toEqual({
      status: 'failure',
      reason: expect.stringContaining('agent reply matched'),
    });
    expect(evaluateTurnRegex([], 'Here is the answer you asked for.')).toEqual({ status: 'ok' });
  });

  it('is enabled by default and skips premium student providers', () => {
    expect(teacherEscalationEnabled()).toBe(true);
    process.env.CARINA_TEACHER_ESCALATION = 'false';
    expect(teacherEscalationEnabled()).toBe(false);
    delete process.env.CARINA_TEACHER_ESCALATION;
    expect(shouldEscalateStudentProvider('deepseek')).toBe(true);
    expect(shouldEscalateStudentProvider('anthropic')).toBe(false);
  });

  it('parses teacher skill JSON from fenced block', () => {
    const text = [
      'Use the filesystem tool with an absolute path.',
      '```json',
      JSON.stringify({
        name: 'open-local-file',
        description: 'Open a file when the user gives a path',
        when_to_use: 'User asks to read a local file',
        procedure: ['Resolve path', 'Call filesystem read'],
        pitfalls: ['Relative paths'],
        verification: ['File contents returned'],
      }),
      '```',
    ].join('\n');
    const draft = parseTeacherSkillDraft(text);
    expect(draft?.name).toBe('open-local-file');
    expect(draft?.procedure).toHaveLength(2);
  });

  it('persists teacher skill to CARINA_HOME', async () => {
    const home = path.join('/tmp', `carina-teacher-${Date.now()}`);
    process.env.HOME = home;
    const skillPath = await persistTeacherSkill({
      name: 'test-skill',
      description: 'Test skill',
      whenToUse: 'When testing',
      procedure: ['Step one', 'Step two'],
    });
    expect(skillPath).toContain('teacher-skills');
    const content = await fs.readFile(skillPath, 'utf8');
    expect(content).toContain('name: test-skill');
    expect(content).toContain('Step one');
    await fs.rm(home, { recursive: true, force: true });
  });
});
