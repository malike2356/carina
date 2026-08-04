import { describe, expect, it } from 'vitest';
import { extractToolNames, normalizeStreamPayload, stripToolMarkers } from './stream-parser';

describe('stream-parser', () => {
  it('parses JSON string chunks from Carina SSE', () => {
    expect(normalizeStreamPayload('"hello"')).toEqual({ content: 'hello' });
  });

  it('parses object chunks with error', () => {
    expect(normalizeStreamPayload('{"error":"quota"}')).toEqual({ error: 'quota' });
  });

  it('parses sessionId bootstrap events from cloud chat', () => {
    expect(
      normalizeStreamPayload('{"sessionId":"550e8400-e29b-41d4-a716-446655440000"}'),
    ).toEqual({ sessionId: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('parses sessionId bootstrap events from cloud chat', () => {
    expect(
      normalizeStreamPayload('{"sessionId":"550e8400-e29b-41d4-a716-446655440000"}'),
    ).toEqual({ sessionId: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('parses typed chat access bootstrap events from cloud chat', () => {
    expect(
      normalizeStreamPayload(JSON.stringify({
        access: {
          mode: 'mini',
          freeMessagesUsed: 2,
          freeMessagesLimit: 10,
          upgradeUrl: '/billing/aiva?subscribe=1',
          byokUrl: '/settings/keys',
          provider: 'openai',
          model: 'gpt-mini',
        },
      })),
    ).toEqual({
      access: {
        mode: 'mini',
        freeMessagesUsed: 2,
        freeMessagesLimit: 10,
        upgradeUrl: '/billing/aiva?subscribe=1',
        byokUrl: '/settings/keys',
        provider: 'openai',
        model: 'gpt-mini',
      },
    });
  });

  it('rejects malformed chat access bootstrap events', () => {
    expect(
      normalizeStreamPayload(JSON.stringify({
        access: {
          mode: 'mini',
          freeMessagesUsed: '2',
          freeMessagesLimit: 10,
        },
      })),
    ).toEqual({});
  });

  it('extracts tool names from stream text', () => {
    const text = 'Thinking\n[using web-search...]\nResults\n[using file...]\n';
    expect(extractToolNames(text)).toEqual(['web-search', 'file']);
  });

  it('strips tool markers for display', () => {
    const text = 'Answer\n[using shell...]\nDone';
    expect(stripToolMarkers(text)).toBe('Answer\nDone');
  });
});
