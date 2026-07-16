import { describe, expect, it } from 'vitest';
import { appendLog, clearLogs } from '../log-buffer.js';
import { buildDebugState, sanitizeDebugLine } from './debug-state.js';

describe('debug state', () => {
  it('sanitizes secrets and ids', () => {
    expect(sanitizeDebugLine('token=abc sk_test_123456789 adad9243-955c-42d1-a876-4c806e554679')).toContain('token=[redacted]');
    expect(sanitizeDebugLine('sk_test_123456789')).toBe('[secret]');
    expect(sanitizeDebugLine('adad9243-955c-42d1-a876-4c806e554679')).toBe('[id]');
  });

  it('builds a compact render state summary', () => {
    clearLogs();
    appendLog('runtime.error token=abc');
    const state = buildDebugState({
      sessionId: 'adad9243-955c-42d1-a876-4c806e554679',
      model: 'deepseek-chat',
      overlay: 'debug',
      transportMode: 'json-rpc',
      connected: false,
      terminalColumns: 100,
      terminalRows: 30,
      messageCount: 4,
      tokenCount: 80,
      lastCommand: '/debug',
      events: [],
    });
    expect(state.lines.join('\n')).toContain('Transport: json-rpc offline');
    expect(state.copyable).not.toContain('token=abc');
  });
});
