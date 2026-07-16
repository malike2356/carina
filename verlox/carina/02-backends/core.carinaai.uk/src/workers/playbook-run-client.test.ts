import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildKeprixRunUrl, startPlaybookRun } from './playbook-run-client.js';

describe('playbook-run-client', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it('starts a playbook run with carina metadata in initial_state', async () => {
    process.env.KEPRIX_API_BASE_URL = 'https://keprix.example.com';
    process.env.KEPRIX_SERVICE_TOKEN = 'svc-token';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          run_id: 'run-1',
          graph_id: 'aiva-deal-analyse',
          status: 'running',
          workspace_id: 'ws-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const run = await startPlaybookRun({
      playbookId: 'aiva-deal-analyse',
      workspaceId: 'ws-1',
      variables: { min_score: 70 },
      metadata: {
        worker_id: 'worker-1',
        tenant_id: 'ws-1',
        template_id: 'aiva-deal-analyse',
        trigger: 'manual',
      },
    });

    expect(run.runId).toBe('run-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://keprix.example.com/api/playbook-runs/start',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"_carina_worker_id":"worker-1"'),
      }),
    );
  });

  it('builds keprix run url from studio base', () => {
    process.env.KEPRIX_STUDIO_BASE_URL = 'https://studio.keprix.example.com';
    expect(buildKeprixRunUrl('run-abc')).toBe('https://studio.keprix.example.com/playbooks/run-abc');
  });
});
