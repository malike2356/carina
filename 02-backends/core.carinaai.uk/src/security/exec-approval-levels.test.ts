import { describe, expect, it } from 'vitest';
import {
  resolveExecApprovalLevel,
  shellExecRequiresApproval,
} from './exec-approval-levels.js';

describe('exec-approval-levels', () => {
  it('defaults to on-miss', () => {
    delete process.env.CARINA_EXEC_APPROVAL_LEVEL;
    expect(resolveExecApprovalLevel()).toBe('on-miss');
    expect(shellExecRequiresApproval('ls', false)).toBe(false);
  });

  it('requires approval for all shell commands in full mode', () => {
    process.env.CARINA_EXEC_APPROVAL_LEVEL = 'full';
    expect(shellExecRequiresApproval('ls -la', false)).toBe(true);
    delete process.env.CARINA_EXEC_APPROVAL_LEVEL;
  });
});
