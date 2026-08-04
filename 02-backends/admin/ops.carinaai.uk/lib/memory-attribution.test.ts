import { describe, expect, it } from 'vitest';
import {
  buildMemoryAttribution,
  parseAivaSessionId,
} from './memory-attribution.js';

describe('parseAivaSessionId', () => {
  it('parses canonical contact sessions', () => {
    expect(
      parseAivaSessionId('aiva-c177fe51-0e1e-441b-99d1-4c1cd64da55c-contact-7028923891'),
    ).toEqual({
      workerId: 'c177fe51-0e1e-441b-99d1-4c1cd64da55c',
      channel: 'contact',
      peerId: '7028923891',
    });
  });

  it('parses legacy telegram sessions', () => {
    expect(
      parseAivaSessionId('aiva-c177fe51-0e1e-441b-99d1-4c1cd64da55c-telegram-7028923891'),
    ).toEqual({
      workerId: 'c177fe51-0e1e-441b-99d1-4c1cd64da55c',
      channel: 'telegram',
      peerId: '7028923891',
    });
  });

  it('parses web-app sessions', () => {
    expect(
      parseAivaSessionId('aiva-c177fe51-0e1e-441b-99d1-4c1cd64da55c-web-app'),
    ).toEqual({
      workerId: 'c177fe51-0e1e-441b-99d1-4c1cd64da55c',
      channel: 'web',
      peerId: 'app',
    });
  });
});

describe('buildMemoryAttribution', () => {
  it('labels assistant rows as the Aiva', () => {
    const attr = buildMemoryAttribution({
      role: 'assistant',
      sessionId: 'aiva-c177fe51-0e1e-441b-99d1-4c1cd64da55c-telegram-1',
      aivaName: 'Selorm',
      customerName: 'Laud Paul-Gablah',
      customerEmail: 'lordsesame@gmail.com',
    });
    expect(attr.actorLabel).toBe('Aiva · Selorm');
    expect(attr.customerLabel).toContain('Laud Paul-Gablah');
  });

  it('labels user rows with contact display name when present', () => {
    const attr = buildMemoryAttribution({
      role: 'user',
      sessionId: 'aiva-c177fe51-0e1e-441b-99d1-4c1cd64da55c-contact-7028923891',
      aivaName: 'Selorm',
      customerName: 'Laud Paul-Gablah',
      peerDisplayName: 'Laud',
    });
    expect(attr.actorLabel).toBe('Laud (contact)');
  });
});
