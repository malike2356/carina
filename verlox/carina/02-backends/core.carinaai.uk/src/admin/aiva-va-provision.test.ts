import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));

describe('aiva-va-provision', () => {
  beforeEach(() => {
    query.mockReset();
    vi.resetModules();
  });

  it('creates a new member when email is new', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'uuid-1',
          name: 'Ada',
          email: 'ada@example.com',
          max_load: 5,
          available: true,
          source: 'verlox_mis',
          verlox_va_assistant_id: '42',
        }],
      });

    const { provisionAivaVaMember } = await import('./aiva-va-provision.js');
    const result = await provisionAivaVaMember({
      name: 'Ada',
      email: 'Ada@Example.com',
      verloxVaAssistantId: 42,
      source: 'verlox_mis',
    });

    expect(result.created).toBe(true);
    expect(result.email).toBe('ada@example.com');
    expect(result.verloxVaAssistantId).toBe('42');
  });

  it('links existing member by email without duplicating', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          id: 'uuid-2',
          name: 'Old',
          email: 'bob@example.com',
          max_load: 3,
          available: true,
          source: 'manual',
          verlox_va_assistant_id: null,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'uuid-2',
          name: 'Bob',
          email: 'bob@example.com',
          max_load: 5,
          available: true,
          source: 'migration',
          verlox_va_assistant_id: '9',
        }],
      });

    const { provisionAivaVaMember } = await import('./aiva-va-provision.js');
    const result = await provisionAivaVaMember({
      name: 'Bob',
      email: 'bob@example.com',
      maxLoad: 5,
      verloxVaAssistantId: 9,
      source: 'migration',
    });

    expect(result.created).toBe(false);
    expect(result.linked).toBe(true);
    expect(result.id).toBe('uuid-2');
    expect(result.source).toBe('migration');
  });
});
