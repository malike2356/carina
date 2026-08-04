import { describe, expect, it } from 'vitest';
import { buildIlaudN8nPayload, maskContactId } from './ilaud-event-map.js';
import { resolveN8nIlaudConfig } from './config.js';

describe('ilaud-event-map', () => {
  it('masks contact ids in payload', () => {
    expect(maskContactId('user-123456789')).toBe('user...6789');
  });

  it('builds social inbound payload', () => {
    const payload = buildIlaudN8nPayload({
      eventType: 'social_inbound_received',
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      config: resolveN8nIlaudConfig(),
      metadata: {
        channel: 'linkedin',
        contactId: 'sender-abc',
        inboundText: 'Need a quote please',
      },
    });
    expect(payload?.event).toBe('social_inbound_received');
    expect(payload?.textPreview).toContain('Need a quote');
  });

  it('ignores non-social automation runs', () => {
    const payload = buildIlaudN8nPayload({
      eventType: 'automation_run',
      workspaceId: 'ws-1',
      workerId: 'worker-1',
      config: resolveN8nIlaudConfig(),
      metadata: { automationName: 'Email digest' },
    });
    expect(payload).toBeNull();
  });

  it('routes token expiry to token health webhook', async () => {
    const { resolveN8nWebhookUrl } = await import('./ilaud-event-map.js');
    const config = {
      ...resolveN8nIlaudConfig(),
      engagementWebhookUrl: 'https://n8n.example/webhook/ilaud-engagement',
      tokenHealthWebhookUrl: 'https://n8n.example/webhook/ilaud-token-health',
      postWebhookUrl: 'https://n8n.example/webhook/ilaud-post-schedule',
    };
    expect(resolveN8nWebhookUrl('social_token_expired', config)).toBe(
      'https://n8n.example/webhook/ilaud-token-health',
    );
  });
});
