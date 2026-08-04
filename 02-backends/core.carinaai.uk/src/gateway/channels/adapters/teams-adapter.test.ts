import { describe, expect, it } from 'vitest';
import { TeamsAdapter, validateTeamsJwt } from './teams-adapter.js';

function buildJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('TeamsAdapter', () => {
  const appId = 'teams-app-id';
  const adapter = new TeamsAdapter(true, appId, 'teams-password', 'botframework.com');

  it('parses Bot Framework message activities', () => {
    const message = adapter.parseInbound({
      type: 'message',
      id: 'activity-1',
      text: 'Hello Teams',
      serviceUrl: 'https://smba.trafficmanager.net/uk/',
      from: { id: 'user-1', name: 'Taylor' },
      conversation: { id: 'conv-1', conversationType: 'personal' },
    });

    expect(message?.channel).toBe('teams');
    expect(message?.text).toBe('Hello Teams');
    expect(message?.conversationId).toBe('conv-1');
    expect(message?.isDirect).toBe(true);
  });

  it('validates JWT audience and expiry', () => {
    const token = buildJwt({
      aud: appId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(validateTeamsJwt(token, appId)).toBe(true);
    expect(adapter.validateWebhook({
      headers: { authorization: `Bearer ${token}` },
      body: {},
    })).toBe(true);
  });

  it('rejects missing Authorization header', () => {
    expect(adapter.validateWebhook({ headers: {}, body: {} })).toBe(false);
  });
});
