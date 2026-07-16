import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logAuditEvent,
  logToolExecution,
  logModelRequest,
  logSecurityEvent,
  logAdminAction,
  logAuthEvent,
} from '../audit-logger.js';

// Mock the db pool
const mockQuery = vi.fn();
vi.mock('../../db.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

beforeEach(() => {
  mockQuery.mockReset();
});

describe('logAuditEvent', () => {
  it('inserts an audit event and returns the id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: '550e8400-e29b-41d4-a716-446655440000' }],
    });

    const id = await logAuditEvent({
      tenant_id: 'tenant-01',
      event_type: 'admin',
      action: 'config_changed',
      detail: { key: 'rate_limit', old_value: 100, new_value: 50 },
      severity: 'info',
      session_id: 'abc-123',
      ip_address: '10.0.0.1',
      admin_email: 'admin@example.com',
    });

    expect(id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(mockQuery).toHaveBeenCalledOnce();

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO audit_log');
    expect(params[0]).toBe('tenant-01');
    expect(params[1]).toBe('admin');
    expect(params[2]).toBe('config_changed');
    expect(params[4]).toBe('info');
    expect(params[5]).toBe('abc-123');
    expect(params[6]).toBe('10.0.0.1');
    expect(params[7]).toBe('admin@example.com');
  });

  it('throws when insert returns no row', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(
      logAuditEvent({
        tenant_id: 't',
        event_type: 'auth',
        action: 'login',
        detail: {},
        severity: 'info',
      }),
    ).rejects.toThrow('Failed to insert audit log entry');
  });
});

describe('category-specific helpers', () => {
  beforeEach(() => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'e1' }],
    });
  });

  it('logToolExecution maps tool_execution shape correctly', async () => {
    await logToolExecution({
      tenant_id: 't1',
      action: 'run_code',
      detail: {
        tool_name: 'code_interpreter',
        tool_call_id: 'call-1',
        duration_ms: 1500,
        success: true,
      },
      severity: 'info',
      session_id: 's1',
      ip_address: '1.2.3.4',
    });

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBe('tool_execution');

    const detail = JSON.parse(params[3] as string);
    expect(detail.tool_name).toBe('code_interpreter');
    expect(detail.duration_ms).toBe(1500);
    expect(detail.success).toBe(true);
  });

  it('logModelRequest maps model_request shape correctly', async () => {
    await logModelRequest({
      tenant_id: 't2',
      action: 'chat_completion',
      detail: {
        model: 'gpt-4',
        provider: 'openai',
        prompt_tokens: 500,
        completion_tokens: 200,
        duration_ms: 3000,
        success: true,
      },
      severity: 'info',
    });

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBe('model_request');

    const detail = JSON.parse(params[3] as string);
    expect(detail.model).toBe('gpt-4');
    expect(detail.provider).toBe('openai');
  });

  it('logSecurityEvent maps security shape correctly', async () => {
    await logSecurityEvent({
      tenant_id: 't3',
      action: 'anomaly_detected',
      detail: {
        source: 'anomaly_detector',
        description: 'Unusual tool call pattern',
        instance_id: 'inst-1',
      },
      severity: 'warning',
    });

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBe('security');

    const detail = JSON.parse(params[3] as string);
    expect(detail.source).toBe('anomaly_detector');
    expect(detail.description).toBe('Unusual tool call pattern');
  });

  it('logAdminAction maps admin shape correctly', async () => {
    await logAdminAction({
      tenant_id: 't4',
      action: 'kill_switch_triggered',
      detail: {
        triggered_by: 'operator',
        reason: 'security breach detected',
        agents_stopped: 5,
      },
      severity: 'critical',
      admin_email: 'ops@example.com',
    });

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBe('admin');
    expect(params[7]).toBe('ops@example.com');

    const detail = JSON.parse(params[3] as string);
    expect(detail.reason).toBe('security breach detected');
  });

  it('logAuthEvent maps auth shape correctly', async () => {
    await logAuthEvent({
      tenant_id: 't5',
      action: 'login_failed',
      detail: {
        email: 'user@example.com',
        success: false,
        failure_reason: 'invalid_credentials',
      },
      severity: 'warning',
      ip_address: '5.6.7.8',
    });

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBe('auth');

    const detail = JSON.parse(params[3] as string);
    expect(detail.success).toBe(false);
    expect(detail.failure_reason).toBe('invalid_credentials');
  });
});
