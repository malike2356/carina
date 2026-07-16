import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getStudioHandoffUrl,
  HANDOFF_TTL_SECONDS,
  signStudioHandoffToken,
  verifyStudioHandoffToken,
} from './agent-studio-playbook-bridge.js';

const SECRET = 'test-handoff-secret-32chars!!';

describe('agent-studio-playbook-bridge', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('signs and verifies a studio handoff token', () => {
    const token = signStudioHandoffToken(
      {
        sub: 'user@example.com',
        tenant_id: 'tenant-1',
        carina_user_id: 'user-1',
      },
      SECRET,
      1_700_000_000,
    );
    const claims = verifyStudioHandoffToken(token, SECRET, 1_700_000_000);
    expect(claims).toMatchObject({
      sub: 'user@example.com',
      tenant_id: 'tenant-1',
      carina_user_id: 'user-1',
      aud: 'keprix-studio',
    });
    expect(claims?.exp).toBe(1_700_000_000 + HANDOFF_TTL_SECONDS);
  });

  it('rejects expired handoff tokens', () => {
    const token = signStudioHandoffToken(
      {
        sub: 'user@example.com',
        tenant_id: 'tenant-1',
        carina_user_id: 'user-1',
      },
      SECRET,
      1_700_000_000,
    );
    const expiredAt = 1_700_000_000 + HANDOFF_TTL_SECONDS + 1;
    expect(verifyStudioHandoffToken(token, SECRET, expiredAt)).toBeNull();
  });

  it('builds a studio handoff URL with encoded token', async () => {
    process.env.KEPRIX_STUDIO_BASE_URL = 'https://keprix.example.com';
    process.env.KEPRIX_API_BASE_URL = 'https://keprix.example.com';
    process.env.KEPRIX_HANDOFF_SECRET = SECRET;

    const url = await getStudioHandoffUrl('/playbooks/studio/new', {
      subject: 'user@example.com',
      tenantId: 'tenant-1',
      carinaUserId: 'user-1',
    });

    expect(url).toContain('https://keprix.example.com/playbooks/studio/new?handoff=');
    const parsed = new URL(url);
    const token = parsed.searchParams.get('handoff');
    expect(token).toBeTruthy();
    expect(verifyStudioHandoffToken(token!, SECRET)).not.toBeNull();
  });
});
