import { describe, expect, it, vi } from 'vitest';
import { buildConversationalIntegrationSetupReply } from './conversational-integration-setup.js';

vi.mock('./spinnable-parity-store.js', () => ({
  listToolGrants: vi.fn(async () => [
    { toolSlug: 'gmail', status: 'needs_reauth', scopes: ['read'] },
    { toolSlug: 'google-calendar', status: 'connected', scopes: ['read', 'write'] },
    { toolSlug: 'trello', status: 'connected', scopes: ['read', 'write'] },
  ]),
}));

describe('buildConversationalIntegrationSetupReply', () => {
  it('handles the Gmail configuration request with a secure handoff', async () => {
    const reply = await buildConversationalIntegrationSetupReply({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: 'worker-1',
      message: 'can you configure gmail when i give you the credentials?',
    });

    expect(reply).toContain('Yes.');
    expect(reply).toContain('/aiva/tools');
    expect(reply).toContain('/aiva/tools?tool=gmail');
    expect(reply).toContain('needs reauth');
    expect(reply).toContain('Do not paste passwords, API keys, or OAuth secrets into chat');
  });

  it('handles Trello setup with the app key reference', async () => {
    const reply = await buildConversationalIntegrationSetupReply({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: 'worker-1',
      message: 'can you set up trello for me?',
    });

    expect(reply).toContain('Trello');
    expect(reply).toContain('https://trello.com/app-key');
  });

  it('does not intercept ordinary Trello work when already connected', async () => {
    expect(await buildConversationalIntegrationSetupReply({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: 'worker-1',
      message: 'List my Trello boards',
    })).toBeNull();
  });

  it('intercepts calendar use when Calendar is not connected', async () => {
    const { listToolGrants } = await import('./spinnable-parity-store.js');
    vi.mocked(listToolGrants).mockResolvedValueOnce([]);
    const reply = await buildConversationalIntegrationSetupReply({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: 'worker-1',
      message: 'check my calender for hospital meetings',
    });
    expect(reply).toContain('Google Calendar');
    expect(reply).toContain('/aiva/tools?tool=google-calendar');
    expect(reply).toContain('not connected yet');
  });

  it('intercepts email use when Gmail needs reauth', async () => {
    const reply = await buildConversationalIntegrationSetupReply({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: 'worker-1',
      message: 'Can u check my emails',
    });
    expect(reply).toContain('Gmail');
    expect(reply).toContain('needs reauth');
  });

  it('does not intercept calendar use when Calendar is connected', async () => {
    expect(await buildConversationalIntegrationSetupReply({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: 'worker-1',
      message: 'what is on my calendar tomorrow?',
    })).toBeNull();
  });

  it('does not treat disconnection as setup', async () => {
    expect(await buildConversationalIntegrationSetupReply({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: 'worker-1',
      message: 'Disconnect Trello',
    })).toBeNull();
  });

  it('handles Companies House setup with Developer Hub reference', async () => {
    const { listToolGrants } = await import('./spinnable-parity-store.js');
    vi.mocked(listToolGrants).mockResolvedValueOnce([]);
    const reply = await buildConversationalIntegrationSetupReply({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: 'worker-1',
      message: 'can you set up companies house for me?',
    });
    expect(reply).toContain('Companies House');
    expect(reply).toContain('/aiva/tools?tool=companies-house');
    expect(reply).toContain('https://developer.company-information.service.gov.uk/');
  });
});
