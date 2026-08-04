import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  combineVerdict,
  scoreAgentHeuristics,
  scoreIdentity,
  scoreStatic,
  scoreUrls,
  shouldFailClosed,
  buildSafeSummary,
} from '../verdict.js';
import { DEFAULT_SHIELD_POLICY, type ShieldMessage } from '../types.js';
import { extractLinks } from '../adapters/helpers.js';
import { listShieldAdapters } from '../adapters/registry.js';
import { emailShieldAdapter } from '../adapters/email-adapter.js';
import { slackShieldAdapter } from '../adapters/slack-adapter.js';
import { teamsShieldAdapter } from '../adapters/teams-adapter.js';
import { telegramShieldAdapter } from '../adapters/telegram-adapter.js';
import { whatsappShieldAdapter } from '../adapters/whatsapp-adapter.js';
import { discordShieldAdapter } from '../adapters/discord-adapter.js';
import { smsShieldAdapter } from '../adapters/sms-adapter.js';
import { webShieldAdapter } from '../adapters/web-adapter.js';
import type { ShieldProtection } from '../types.js';

vi.mock('../../security/scout-client.js', () => ({
  reportEvent: vi.fn().mockResolvedValue(undefined),
}));

const protection: ShieldProtection = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  channel: 'email',
  externalKey: 'example.com',
  mode: 'protect',
  status: 'active',
  deliveryTarget: {},
  policy: DEFAULT_SHIELD_POLICY,
  scoutRefs: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('channel-shield verdict', () => {
  it('marks eicar as malicious', () => {
    const staticScan = scoreStatic(
      [],
      'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      DEFAULT_SHIELD_POLICY,
    );
    const { verdict } = combineVerdict(
      {
        identity: 0,
        url: 0,
        staticScan: staticScan.score,
        agent: 0,
        sandbox: 0,
        flags: staticScan.flags,
      },
      DEFAULT_SHIELD_POLICY,
    );
    expect(verdict).toBe('malicious');
  });

  it('scores spoof identity', () => {
    const id = scoreIdentity({ spf: 'fail', dmarc: 'fail' });
    expect(id.score).toBeGreaterThanOrEqual(70);
  });

  it('flags phishing phrases as suspect', () => {
    const agent = scoreAgentHeuristics('Urgent action required: verify your account now');
    const { verdict } = combineVerdict(
      { identity: 0, url: 0, staticScan: 0, agent: agent.score, sandbox: 0, flags: agent.flags },
      DEFAULT_SHIELD_POLICY,
    );
    expect(['suspect', 'malicious']).toContain(verdict);
  });

  it('fail-closed defaults', () => {
    expect(shouldFailClosed('malicious', DEFAULT_SHIELD_POLICY)).toBe(true);
    expect(shouldFailClosed('error', DEFAULT_SHIELD_POLICY)).toBe(true);
    expect(shouldFailClosed('clean', DEFAULT_SHIELD_POLICY)).toBe(false);
  });

  it('builds safe summary with deep link', () => {
    const msg = {
      id: 'msg-1',
      channel: 'email',
      envelope: { from: { id: 'a@b.com', display: 'Alice' }, subject: 'Invoice' },
    } as ShieldMessage;
    const summary = buildSafeSummary(msg, 'malicious', 'https://app.carinaai.uk');
    expect(summary).toContain('Channel Shield held');
    expect(summary).toContain('/settings/channel-shield?message=msg-1');
    expect(summary).not.toMatch(/[\u2013\u2014]/);
  });

  it('extracts links', () => {
    expect(extractLinks('see https://evil.example/phish now')).toEqual(['https://evil.example/phish']);
    expect(scoreUrls(['https://bit.ly/x'], '').flags).toContain('shortener');
  });
});

describe('channel-shield adapters registry', () => {
  it('registers all eight adapters', () => {
    const channels = listShieldAdapters().map((a) => a.channel).sort();
    expect(channels).toEqual([
      'discord',
      'email',
      'slack',
      'sms',
      'teams',
      'telegram',
      'web',
      'whatsapp',
    ]);
  });
});

describe('adapter ingest fixtures', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  const cases: Array<{
    name: string;
    adapter: typeof emailShieldAdapter;
    body: unknown;
  }> = [
    {
      name: 'email',
      adapter: emailShieldAdapter,
      body: {
        from: 'attacker@evil.test',
        to: ['you@example.com'],
        subject: 'Hello',
        text: 'clean body https://ok.example',
        messageId: 'email-1',
        authSignals: { spf: 'pass', dkim: 'pass', dmarc: 'pass' },
      },
    },
    {
      name: 'slack',
      adapter: slackShieldAdapter,
      body: {
        team_id: 'T1',
        event: { type: 'message', user: 'U1', text: 'hi', ts: '1.2', channel: 'C1' },
      },
    },
    {
      name: 'teams',
      adapter: teamsShieldAdapter,
      body: { id: 't1', text: 'teams hi', from: { id: 'u1', name: 'User' }, conversation: { id: 'conv1' } },
    },
    {
      name: 'telegram',
      adapter: telegramShieldAdapter,
      body: {
        message: {
          message_id: 9,
          text: 'tg hi',
          from: { id: 1, first_name: 'A' },
          chat: { id: 2 },
        },
      },
    },
    {
      name: 'whatsapp',
      adapter: whatsappShieldAdapter,
      body: {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [{ id: 'w1', from: '15551234567', text: { body: 'wa hi' } }],
                },
              },
            ],
          },
        ],
      },
    },
    {
      name: 'discord',
      adapter: discordShieldAdapter,
      body: { id: 'd1', content: 'discord hi', author: { id: 'a1', username: 'bob' }, channel_id: 'ch1' },
    },
    {
      name: 'sms',
      adapter: smsShieldAdapter,
      body: { MessageSid: 'SM1', From: '+15550001', To: '+15550002', Body: 'sms hi', NumMedia: 0 },
    },
    {
      name: 'web',
      adapter: webShieldAdapter,
      body: { messageId: 'web1', text: 'web hi', visitorId: 'v1', conversationId: 'c1' },
    },
  ];

  for (const c of cases) {
    it(`${c.name} normalises to envelope`, async () => {
      const ok = await c.adapter.authenticateIngress({ body: c.body, headers: {} });
      expect(ok).toBe(true);
      const env = await c.adapter.ingest({ body: c.body, headers: {} }, { ...protection, channel: c.adapter.channel });
      expect(env.channel).toBe(c.adapter.channel);
      expect(env.externalMessageId).toBeTruthy();
      expect(env.text.length).toBeGreaterThan(0);
      expect(env.workspaceId).toBe(protection.workspaceId);
    });
  }

  it('email malicious attachment fixture scores high', async () => {
    const env = await emailShieldAdapter.ingest(
      {
        body: {
          from: 'bad@evil.test',
          to: ['you@example.com'],
          subject: 'invoice',
          text: 'see attached',
          messageId: 'email-bad',
          attachments: [
            {
              id: '1',
              filename: 'payload.exe',
              contentType: 'application/x-msdownload',
              sizeBytes: 100,
            },
          ],
        },
      },
      protection,
    );
    const staticScan = scoreStatic(env.attachments, env.text, DEFAULT_SHIELD_POLICY);
    expect(staticScan.score).toBeGreaterThanOrEqual(70);
  });
});
