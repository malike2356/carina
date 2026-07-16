import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.js', () => ({
  query: (...args: unknown[]) => queryMock(...args),
}));

vi.mock('./pty-bridge-core.js', () => ({
  resolveCarinaCliCommand: vi.fn(),
}));

vi.mock('./scout.js', () => ({
  scoutConsoleGet: vi.fn(),
}));

describe('operator-data learning audit actions', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('records a learning event when an operator promotes a draft skill', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'skill-1', name: 'draft-skill' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { promoteDraftSkill } = await import('./operator-data.js');
    await expect(promoteDraftSkill('skill-1')).resolves.toBe(true);

    expect(queryMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('skill_promoted'),
      expect.arrayContaining(['__operator__', 'skill-1', 'draft-skill']),
    );
  });

  it('records a learning event when an operator archives a draft skill', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ id: 'skill-2', name: 'weak-draft' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { archiveDraftSkill } = await import('./operator-data.js');
    await expect(archiveDraftSkill('skill-2')).resolves.toBe(true);

    expect(queryMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('skill_archived'),
      expect.arrayContaining(['__operator__', 'skill-2', 'weak-draft']),
    );
  });
});
