import { describe, expect, it } from 'vitest';

/**
 * Lightweight contract tests for the core → app outbound notify payload.
 * Runtime notify needs CARINA_INTERNAL_KEY + network; here we only assert shape helpers.
 */
function buildOutboundPayload(input: {
  workspaceId: string;
  workerId?: string;
  to: string;
  subject: string;
  body: string;
  fromAddress?: string;
  gmailMessageId?: string | null;
}) {
  return {
    workspaceId: input.workspaceId,
    workerId: input.workerId,
    to: input.to.trim(),
    subject: input.subject.trim(),
    body: input.body,
    fromAddress: input.fromAddress ?? 'Aiva via Gmail',
    externalId: input.gmailMessageId ?? null,
    source: 'aiva' as const,
  };
}

describe('aiva email outbound notify payload', () => {
  it('maps gmailMessageId to externalId and source aiva', () => {
    const payload = buildOutboundPayload({
      workspaceId: 'ws-1',
      workerId: 'w-1',
      to: ' la@example.com ',
      subject: ' Upgrade ',
      body: 'Hello',
      fromAddress: 'Selorm via Gmail',
      gmailMessageId: '19f7ab1fb9835382',
    });
    expect(payload).toEqual({
      workspaceId: 'ws-1',
      workerId: 'w-1',
      to: 'la@example.com',
      subject: 'Upgrade',
      body: 'Hello',
      fromAddress: 'Selorm via Gmail',
      externalId: '19f7ab1fb9835382',
      source: 'aiva',
    });
  });
});
