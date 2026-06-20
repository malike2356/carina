import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  parseGitterInbound,
  parseMastodonInbound,
  parseRedditInbound,
  parseZulipInbound,
  createStubChannelAdapter,
  STUB_CHANNEL_NAMES,
} from './catalog-stub-adapters.js';
import { CATALOG_STUB_CHANNELS, buildCatalogChannelSpecs } from '../catalog-channel-specs.js';
import { verifySharedSecret } from './catalog-webhook-base.js';

describe('catalog stub channel parsers', () => {
  it('parseZulipInbound handles zulip message events', () => {
    const msg = parseZulipInbound({
      type: 'zulip',
      message: {
        id: 99,
        content: 'hello team',
        sender_id: 42,
        sender_email: 'alice@example.com',
        stream_id: 7,
      },
    });
    expect(msg?.channel).toBe('zulip');
    expect(msg?.text).toBe('hello team');
    expect(msg?.conversationId).toBe('7');
  });

  it('parseGitterInbound handles gitter webhook payloads', () => {
    const msg = parseGitterInbound({
      id: 'abc',
      text: 'ping',
      roomId: 'room1',
      fromUser: { id: 'u1', username: 'alice' },
    });
    expect(msg?.channel).toBe('gitter');
    expect(msg?.externalUserId).toBe('u1');
    expect(msg?.conversationId).toBe('room1');
  });

  it('parseMastodonInbound strips HTML from status content', () => {
    const msg = parseMastodonInbound({
      id: '1',
      content: '<p>hello</p>',
      account: { id: '9', username: 'bob' },
      visibility: 'direct',
    });
    expect(msg?.text).toBe('hello');
    expect(msg?.isDirect).toBe(true);
  });

  it('parseRedditInbound accepts generic bridge payloads', () => {
    const msg = parseRedditInbound({
      text: 'comment',
      user_id: 'u2',
      conversation_id: 't3_abc',
    });
    expect(msg?.channel).toBe('reddit');
    expect(msg?.conversationId).toBe('t3_abc');
  });
});

describe('catalog stub adapters registry', () => {
  it('registers all 19 former stub channels', () => {
    expect(STUB_CHANNEL_NAMES).toHaveLength(19);
    expect(STUB_CHANNEL_NAMES).toContain('zulip');
    expect(STUB_CHANNEL_NAMES).toContain('apple-business-chat');
  });

  it('creates disabled adapters when env is missing', () => {
    const adapter = createStubChannelAdapter('gitter', false);
    expect(adapter?.name).toBe('gitter');
    expect(adapter?.enabled).toBe(false);
  });
});

describe('catalog-channel-specs stubs cleared', () => {
  it('has no catalog stub channels remaining', () => {
    expect(CATALOG_STUB_CHANNELS.size).toBe(0);
  });

  it('uses live transports instead of webhook-stub', () => {
    const specs = buildCatalogChannelSpecs();
    const transports = specs.map((s) => s.transport?.() ?? '');
    expect(transports.some((t) => t === 'webhook-stub')).toBe(false);
    expect(transports).toContain('zulip-bot-api');
    expect(transports).toContain('mastodon-rest-api');
  });
});

describe('catalog webhook validation', () => {
  it('verifySharedSecret accepts matching header secret', () => {
    expect(verifySharedSecret({
      headers: { 'x-webhook-secret': 'sekrit' },
      body: {},
    }, 'sekrit')).toBe(true);
  });
});

describe('catalog stub send (mocked fetch)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sendGitterMessage posts to gitter API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('GITTER_TOKEN', 'gt_token');

    vi.resetModules();
    const { sendGitterMessage } = await import('./catalog-webhook-sends.js');
    await sendGitterMessage({ conversationId: 'room/x', text: 'hello' }, fetchMock);

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('api.gitter.im');
    expect(String(init.headers && (init.headers as Record<string, string>).Authorization)).toContain('gt_token');
  });
});
