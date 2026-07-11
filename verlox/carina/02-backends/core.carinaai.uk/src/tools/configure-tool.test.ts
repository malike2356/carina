import { beforeEach, describe, expect, it, vi } from 'vitest';

const { tmpHome } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require('node:os') as typeof import('node:os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('node:path') as typeof import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-configure-test-'));
  return { tmpHome: dir };
});

vi.mock('../config/paths.js', () => ({
  CARINA_HOME: tmpHome,
}));

vi.mock('../api/channel-config-api.js', () => ({
  getConfiguredChannels: vi.fn().mockResolvedValue([]),
  saveChannelConfiguration: vi.fn(),
  removeChannelConfiguration: vi.fn(),
  testChannelConfiguration: vi.fn(),
}));

vi.mock('../config/settings-store.js', () => ({
  readDomainSettings: vi.fn().mockResolvedValue({}),
  saveDomainSettings: vi.fn().mockResolvedValue({ ok: true }),
  isDomainConfigured: vi.fn().mockResolvedValue(false),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../webhooks/store.js', () => ({
  WEBHOOK_EVENTS: [
    'process.complete',
    'process.failure',
    'process.watch',
    'cron.complete',
    'kanban.move',
    'agent.turn.complete',
    'delegation.complete',
  ],
  listSubscriptions: vi.fn().mockResolvedValue([]),
  createSubscription: vi.fn(),
  disableSubscription: vi.fn(),
  subscriptionPayload: (sub: Record<string, unknown>, includeSecret = false) => ({
    id: sub.id,
    url: sub.url,
    events: sub.events,
    active: sub.active,
    ...(includeSecret && sub.secret ? { secret: sub.secret } : {}),
  }),
}));

import fs from 'node:fs';
import path from 'node:path';
import { configureTool } from './configure-tool.js';
import { findDomainByAlias, ALL_CONFIG_DOMAINS } from '../config/settings-requirements.js';
import { createSubscription, listSubscriptions } from '../webhooks/store.js';

const createSubscriptionMock = vi.mocked(createSubscription);
const listSubscriptionsMock = vi.mocked(listSubscriptions);

describe('configureTool companion + notion + webhooks', () => {
  beforeEach(() => {
    for (const name of ['devices.json', 'pair-pending-tokens.json', 'pairing.json']) {
      const p = path.join(tmpHome, name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    vi.clearAllMocks();
    listSubscriptionsMock.mockResolvedValue([]);
  });

  it('registers device:companion and integration:notion domains', () => {
    expect(ALL_CONFIG_DOMAINS.some((d) => d.id === 'device:companion')).toBe(true);
    expect(ALL_CONFIG_DOMAINS.some((d) => d.id === 'integration:notion')).toBe(true);
    expect(ALL_CONFIG_DOMAINS.some((d) => d.id === 'integration:webhooks')).toBe(true);
    expect(ALL_CONFIG_DOMAINS.some((d) => d.id === 'integration:google-workspace')).toBe(true);
    expect(findDomainByAlias('pair phone')?.id).toBe('device:companion');
    expect(findDomainByAlias('notion')?.id).toBe('integration:notion');
    expect(findDomainByAlias('outbound webhook')?.id).toBe('integration:webhooks');
    expect(findDomainByAlias('google workspace')?.id).toBe('integration:google-workspace');
    expect(findDomainByAlias('gws')?.id).toBe('integration:google-workspace');
  });

  it('starts companion pairing with short code and uri', async () => {
    const result = await configureTool.execute({
      action: 'set',
      target: 'companion',
      values: {},
    });
    expect(result.success).toBe(true);
    expect(result.status).toBe('pairing_started');
    expect(typeof result.shortCode).toBe('string');
    expect(String(result.shortCode).length).toBeGreaterThanOrEqual(4);
    expect(String(result.uri)).toContain('carina://pair?token=');
    expect(String(result.deepLink)).toContain('carina://pair?token=');
    expect(typeof result.token).toBe('string');
  });

  it('lists companion devices when none paired', async () => {
    const result = await configureTool.execute({
      action: 'set',
      target: 'device:companion',
      values: { action: 'list' },
    });
    expect(result.success).toBe(true);
    expect(result.devices).toEqual([]);
  });

  it('get companion reports not configured when empty', async () => {
    const result = await configureTool.execute({
      action: 'get',
      target: 'pair mobile',
    });
    expect(result.domainId).toBe('device:companion');
    expect(result.configured).toBe(false);
  });

  it('notion set with empty values returns required NOTION_API_KEY', async () => {
    const result = await configureTool.execute({
      action: 'set',
      target: 'notion',
      values: {},
    });
    expect(result.status).toBe('needs_values');
    expect(result.domainId).toBe('integration:notion');
    const required = result.requiredFields as Array<{ key: string }>;
    expect(required.some((f) => f.key === 'NOTION_API_KEY')).toBe(true);
  });

  it('webhooks set with empty values asks for url', async () => {
    const result = await configureTool.execute({
      action: 'set',
      target: 'webhooks',
      values: {},
    });
    expect(result.status).toBe('needs_values');
    expect(result.domainId).toBe('integration:webhooks');
    const required = result.requiredFields as Array<{ key: string }>;
    expect(required.some((f) => f.key === 'url')).toBe(true);
  });

  it('webhooks create returns signing secret once', async () => {
    createSubscriptionMock.mockResolvedValue({
      id: 'sub-1',
      url: 'https://example.com/hooks/carina',
      events: ['agent.turn.complete'],
      secret: 'whsec_test_secret',
      active: true,
      name: null,
      description: null,
      maxAttempts: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
      disabledAt: null,
    });

    const result = await configureTool.execute({
      action: 'set',
      target: 'outbound webhook',
      values: {
        url: 'https://example.com/hooks/carina',
        events: 'agent.turn.complete',
      },
    });
    expect(result.success).toBe(true);
    expect(result.status).toBe('created');
    expect((result.subscription as { secret?: string }).secret).toBe('whsec_test_secret');
    expect(createSubscriptionMock).toHaveBeenCalled();
  });

  it('rejects non-https webhook urls', async () => {
    const result = await configureTool.execute({
      action: 'set',
      target: 'webhooks',
      values: { url: 'http://evil.example/hook' },
    });
    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('HTTPS');
  });

  it('google workspace empty set asks for client id and secret', async () => {
    const prevId = process.env.GOOGLE_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_CLIENT_SECRET;
    const prevOauthId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const prevOauthSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    const result = await configureTool.execute({
      action: 'set',
      target: 'gws',
      values: {},
    });
    expect(result.status).toBe('needs_values');
    expect(result.domainId).toBe('integration:google-workspace');
    const required = result.requiredFields as Array<{ key: string }>;
    expect(required.some((f) => f.key === 'GOOGLE_CLIENT_ID')).toBe(true);
    expect(required.some((f) => f.key === 'GOOGLE_CLIENT_SECRET')).toBe(true);

    if (prevId !== undefined) process.env.GOOGLE_CLIENT_ID = prevId;
    if (prevSecret !== undefined) process.env.GOOGLE_CLIENT_SECRET = prevSecret;
    if (prevOauthId !== undefined) process.env.GOOGLE_OAUTH_CLIENT_ID = prevOauthId;
    if (prevOauthSecret !== undefined) process.env.GOOGLE_OAUTH_CLIENT_SECRET = prevOauthSecret;
  });

  it('google workspace with client credentials returns auth url', async () => {
    const result = await configureTool.execute({
      action: 'set',
      target: 'google workspace',
      values: {
        GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'csec',
      },
    });
    expect(result.status).toBe('needs_oauth');
    expect(String(result.authUrl)).toContain('accounts.google.com');
    expect(result.nextField).toMatchObject({ key: 'oauth_code' });
  });

  it('list includes Devices, Notion, and webhooks', async () => {
    const result = await configureTool.execute({ action: 'list' });
    const categories = result.categories as Array<{
      category: string;
      items: Array<{ id: string }>;
    }>;
    const devices = categories.find((c) => c.category === 'Devices');
    expect(devices?.items.some((i) => i.id === 'device:companion')).toBe(true);
    const integrations = categories.find((c) => c.category === 'Integrations');
    expect(integrations?.items.some((i) => i.id === 'integration:notion')).toBe(true);
    expect(integrations?.items.some((i) => i.id === 'integration:webhooks')).toBe(true);
    expect(integrations?.items.some((i) => i.id === 'integration:google-workspace')).toBe(true);
  });
});
