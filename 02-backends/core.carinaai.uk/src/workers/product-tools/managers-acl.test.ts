import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../memory/db.js', () => {
  const query = vi.fn();
  return { pool: { query } };
});

vi.mock('./features.js', () => ({
  loadDepthFeatures: () => ({
    orgs: { enabled: true, workersAsManagers: true, canvasEnabled: true },
  }),
}));

import { pool } from '../../memory/db.js';
import { assertNotManagerWorkerVaultAccess } from '../aiva-parity-store.js';

describe('workers-as-managers vault ACL', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('allows when no acting manager is provided', async () => {
    await expect(
      assertNotManagerWorkerVaultAccess('ws-1', undefined, 'worker-2'),
    ).resolves.toBeUndefined();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('denies when acting manager is registered on the target worker', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never);
    await expect(
      assertNotManagerWorkerVaultAccess('ws-1', 'manager-1', 'worker-2'),
    ).rejects.toThrow(/cannot read peer vault/);
  });

  it('allows when acting manager is not linked', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    await expect(
      assertNotManagerWorkerVaultAccess('ws-1', 'manager-1', 'worker-2'),
    ).resolves.toBeUndefined();
  });
});
