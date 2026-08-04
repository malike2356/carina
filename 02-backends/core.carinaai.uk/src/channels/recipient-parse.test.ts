import { describe, expect, it } from 'vitest';
import {
  looksLikeLoginHandle,
  parseTelegramRecipient,
  resolveOperatorDisplayName,
} from './recipient-parse.js';

describe('recipient-parse', () => {
  it('parses telegram usernames and web links', () => {
    expect(parseTelegramRecipient('@Baffour19')).toBe('@Baffour19');
    expect(parseTelegramRecipient('Baffour19')).toBe('@Baffour19');
    expect(parseTelegramRecipient('https://web.telegram.org/k/#@Baffour19')).toBe('@Baffour19');
    expect(parseTelegramRecipient('https://t.me/Baffour19')).toBe('@Baffour19');
    expect(parseTelegramRecipient('123456789')).toBe('123456789');
  });

  it('detects login-style owner names', () => {
    expect(looksLikeLoginHandle('lordsesame', 'lordsesame@gmail.com')).toBe(true);
    expect(looksLikeLoginHandle('Laud Paul-Gablah')).toBe(false);
  });

  it('prefers preferred name over login owner name', () => {
    expect(resolveOperatorDisplayName({
      preferredName: 'Laud',
      ownerName: 'lordsesame',
      ownerEmail: 'lordsesame@gmail.com',
    })).toBe('Laud');
    expect(resolveOperatorDisplayName({
      ownerName: 'lordsesame',
      ownerEmail: 'lordsesame@gmail.com',
      userProfileFacts: ['Name: Laud Paul-Gablah'],
    })).toBe('Laud Paul-Gablah');
  });
});
