import { describe, expect, it } from 'vitest';
import {
  findChannelByAlias,
  getRequiredFields,
  getSensitiveFieldKeys,
  listChannelSummaries,
  CHANNEL_REQUIREMENTS,
} from './channel-requirements.js';

describe('findChannelByAlias', () => {
  it('resolves by exact id', () => {
    expect(findChannelByAlias('telegram')?.id).toBe('telegram');
  });

  it('resolves "Telegram" case-insensitively', () => {
    expect(findChannelByAlias('Telegram')?.id).toBe('telegram');
  });

  it('resolves alias "tg"', () => {
    expect(findChannelByAlias('tg')?.id).toBe('telegram');
  });

  it('resolves alias "smtp"', () => {
    expect(findChannelByAlias('smtp')?.id).toBe('email');
  });

  it('resolves alias "mail"', () => {
    expect(findChannelByAlias('mail')?.id).toBe('email');
  });

  it('resolves alias "imap"', () => {
    expect(findChannelByAlias('imap')?.id).toBe('email');
  });

  it('resolves alias "wa"', () => {
    expect(findChannelByAlias('wa')?.id).toBe('whatsapp');
  });

  it('resolves alias "ms teams"', () => {
    expect(findChannelByAlias('ms teams')?.id).toBe('teams');
  });

  it('returns null for unknown input', () => {
    expect(findChannelByAlias('unknown-channel-xyz')).toBeNull();
  });
});

describe('getRequiredFields', () => {
  it('returns only required fields for telegram', () => {
    const fields = getRequiredFields('telegram');
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.every((f) => !f.optional)).toBe(true);
  });

  it('returns empty array for unknown channelId', () => {
    expect(getRequiredFields('does-not-exist')).toEqual([]);
  });

  it('every channel has at least one required field', () => {
    for (const ch of CHANNEL_REQUIREMENTS) {
      const required = getRequiredFields(ch.id);
      expect(required.length, `${ch.id} has no required fields`).toBeGreaterThan(0);
    }
  });
});

describe('getSensitiveFieldKeys', () => {
  it('flags bot_token as sensitive', () => {
    expect(getSensitiveFieldKeys().has('bot_token')).toBe(true);
  });

  it('flags imap_password as sensitive', () => {
    expect(getSensitiveFieldKeys().has('imap_password')).toBe(true);
  });

  it('flags smtp_password as sensitive', () => {
    expect(getSensitiveFieldKeys().has('smtp_password')).toBe(true);
  });

  it('flags auth_token as sensitive', () => {
    expect(getSensitiveFieldKeys().has('auth_token')).toBe(true);
  });

  it('does not flag phone_number_id as sensitive', () => {
    expect(getSensitiveFieldKeys().has('phone_number_id')).toBe(false);
  });
});

describe('listChannelSummaries', () => {
  it('returns an entry for every channel', () => {
    const summaries = listChannelSummaries();
    expect(summaries.length).toBe(CHANNEL_REQUIREMENTS.length);
  });

  it('each summary has id, name, and aliases', () => {
    for (const s of listChannelSummaries()) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(Array.isArray(s.aliases)).toBe(true);
    }
  });
});

describe('example values', () => {
  it('no example contains a real-looking secret', () => {
    const suspiciousPatterns = [/^[A-Za-z0-9]{20,}:[A-Za-z0-9_-]{35,}$/, /^xox[bpa]-[0-9]+-[0-9A-Za-z]+$/];
    for (const ch of CHANNEL_REQUIREMENTS) {
      for (const field of ch.fields) {
        if (field.example) {
          for (const pattern of suspiciousPatterns) {
            expect(
              pattern.test(field.example),
              `${ch.id}.${field.key} example looks like a real credential`,
            ).toBe(false);
          }
        }
      }
    }
  });
});
