import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reportEvent = vi.fn(async () => undefined);

vi.mock('./scout-client.js', () => ({
  reportEvent,
}));

describe('critical-event-attestation', () => {
  beforeEach(() => {
    vi.resetModules();
    reportEvent.mockClear();
    process.env.CARINA_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-attest-'));
  });

  it('writes local audit and sends a Scout event for critical security decisions', async () => {
    const { attestCriticalSecurityEvent } = await import('./critical-event-attestation.js');
    const { readSecurityAuditTail } = await import('./security-audit.js');

    await attestCriticalSecurityEvent({
      category: 'tool_rbac',
      action: 'deny',
      detail: 'viewer denied shell-exec',
      sessionId: 'session-1',
      toolName: 'shell-exec',
      severity: 'critical',
      metadata: { role: 'viewer' },
    });

    expect(readSecurityAuditTail(1)[0]).toMatchObject({
      category: 'tool_rbac',
      action: 'deny',
      detail: 'viewer denied shell-exec',
      sessionId: 'session-1',
      toolName: 'shell-exec',
      metadata: expect.objectContaining({ attestationRequested: true }),
    });
    expect(reportEvent).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'critical',
      event_type: 'tool_rbac_deny',
      description: 'viewer denied shell-exec',
      session_id: 'session-1',
      metadata: expect.objectContaining({
        category: 'tool_rbac',
        action: 'deny',
        toolName: 'shell-exec',
      }),
    }));
  });
});
