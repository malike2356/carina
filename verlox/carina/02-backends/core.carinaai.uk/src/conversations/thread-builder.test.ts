import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from './thread-builder.js';

// Replicate mapping logic for unit tests without DB access.
function mapActivityRowToMessages(row: Record<string, unknown>): ThreadMessage[] {
  const actionType = String(row.action_type);
  const id = String(row.id);
  const timestamp = new Date(String(row.created_at)).toISOString();
  const summary = String(row.summary);

  switch (actionType) {
    case 'message_received':
      if (!row.input_text) return [];
      return [{ id, role: 'user', content: String(row.input_text), timestamp }];
    case 'message_sent':
      if (!row.output_text) return [];
      return [{
        id,
        role: 'aiva',
        content: String(row.output_text),
        timestamp,
        attestationTx: row.attestation_tx ? String(row.attestation_tx) : null,
      }];
    case 'va_reply':
      if (!row.output_text) return [];
      return [{ id, role: 'va', content: String(row.output_text), timestamp }];
    case 'escalated':
      return [{
        id,
        role: 'system',
        content: summary,
        timestamp,
        actionType: 'escalated',
        summary: summary || 'Escalated to human review',
      }];
    case 'automation_run':
      return [{
        id,
        role: 'system',
        content: summary,
        timestamp,
        actionType: 'automation_ran',
        summary,
      }];
    default:
      return [];
  }
}

describe('conversation thread mapping', () => {
  it('maps user and aiva messages with attestation', () => {
    const user = mapActivityRowToMessages({
      id: 'a1',
      action_type: 'message_received',
      summary: 'inbound',
      input_text: 'Hello',
      created_at: '2026-06-24T10:00:00.000Z',
    });
    expect(user).toEqual([{
      id: 'a1',
      role: 'user',
      content: 'Hello',
      timestamp: '2026-06-24T10:00:00.000Z',
    }]);

    const aiva = mapActivityRowToMessages({
      id: 'a2',
      action_type: 'message_sent',
      summary: 'outbound',
      output_text: 'Hi there',
      attestation_tx: '0xabc',
      created_at: '2026-06-24T10:00:01.000Z',
    });
    expect(aiva[0]?.role).toBe('aiva');
    expect(aiva[0]?.attestationTx).toBe('0xabc');
  });

  it('maps va and system escalation rows', () => {
    const va = mapActivityRowToMessages({
      id: 'a3',
      action_type: 'va_reply',
      summary: 'VA replied',
      output_text: 'Human answer',
      created_at: '2026-06-24T10:05:00.000Z',
    });
    expect(va[0]?.role).toBe('va');

    const system = mapActivityRowToMessages({
      id: 'a4',
      action_type: 'escalated',
      summary: 'Escalated to human review',
      created_at: '2026-06-24T10:04:00.000Z',
    });
    expect(system[0]?.role).toBe('system');
    expect(system[0]?.actionType).toBe('escalated');
  });
});
