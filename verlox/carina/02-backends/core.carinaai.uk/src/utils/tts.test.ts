import { describe, expect, it, vi } from 'vitest';
import { cleanForSpeech, resolveEdgeTtsBin, scrubSecretsForSpeech } from './tts.js';

describe('cleanForSpeech', () => {
  it('strips markdown symbols', () => {
    expect(cleanForSpeech('**hello** _world_')).toBe('hello world');
  });

  it('converts bullets to commas', () => {
    const result = cleanForSpeech('- item one\n- item two');
    expect(result).toContain(', item one');
    expect(result).toContain(', item two');
  });

  it('collapses whitespace', () => {
    expect(cleanForSpeech('hello\n\n  world')).toBe('hello world');
  });

  it('truncates at word boundary under 4000 chars', () => {
    const long = 'word '.repeat(900);
    const result = cleanForSpeech(long);
    expect(result.length).toBeLessThanOrEqual(4000);
    expect(result.endsWith(' ')).toBe(false);
  });
});

describe('scrubSecretsForSpeech', () => {
  it('redacts settings-domain sensitive labels', () => {
    const out = scrubSecretsForSpeech(
      'GOOGLE_CLIENT_SECRET: supersecretvalue123 NOTION_API_KEY: ntn_abc',
    );
    expect(out.toLowerCase()).toContain('redacted');
    expect(out).not.toContain('supersecretvalue123');
    expect(out).not.toContain('ntn_abc');
  });

  it('redacts pairing token and webhook secret labels', () => {
    const out = scrubSecretsForSpeech(
      'Pairing started. shortCode: AB12CD token: deadbeefdeadbeefdeadbeefdeadbeef secret: whsec_test_secret',
    );
    expect(out).not.toContain('deadbeefdeadbeefdeadbeefdeadbeef');
    expect(out).not.toContain('whsec_test_secret');
    expect(out.toLowerCase()).toContain('redacted');
  });

  it('redacts credential-shaped tokens without labels', () => {
    const out = scrubSecretsForSpeech(
      'Use 1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw next',
    );
    expect(out).toContain('[credential redacted]');
  });
});

describe('resolveEdgeTtsBin', () => {
  it('prefers EDGE_TTS_BIN when set', () => {
    vi.stubEnv('EDGE_TTS_BIN', '/opt/edge-tts');
    expect(resolveEdgeTtsBin()).toBe('/opt/edge-tts');
    vi.unstubAllEnvs();
  });
});
