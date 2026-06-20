import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('scout-findings-api', () => {
  it('resolveScoutApiConfig returns null without API key', async () => {
    vi.stubEnv('LABYRINTH_API_KEY', '');
    const { resolveScoutApiConfig } = await import('./scout-findings-api.js');
    expect(resolveScoutApiConfig()).toBeNull();
  });

  it('lists findings with account scoping', async () => {
    vi.stubEnv('LABYRINTH_API_KEY', 'lsk_test_key');
    vi.stubEnv('SCOUT_BASE_URL', 'http://scout.local:4444');
    vi.stubEnv('SCOUT_ACCOUNT_ID', 'acct-1');

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        findings: [{
          id: 'f1',
          targetId: 't1',
          accountId: 'acct-1',
          tool: 'nuclei',
          findingType: 'cve',
          severity: 'high',
          title: 'Test CVE',
          status: 'open',
        }],
      }),
    });

    const { resolveScoutApiConfig, listScoutFindings } = await import('./scout-findings-api.js');
    const config = resolveScoutApiConfig();
    expect(config).not.toBeNull();

    const findings = await listScoutFindings(config!, { status: 'open' });
    expect(findings).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('account_id=acct-1');
  });

  it('throws ScoutFindingsApiError on HTTP failure', async () => {
    vi.stubEnv('LABYRINTH_API_KEY', 'lsk_test_key');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Finding not found' }),
    });

    const { resolveScoutApiConfig, getScoutFinding, ScoutFindingsApiError } = await import('./scout-findings-api.js');
    await expect(getScoutFinding(resolveScoutApiConfig()!, 'missing'))
      .rejects
      .toBeInstanceOf(ScoutFindingsApiError);
  });
});
