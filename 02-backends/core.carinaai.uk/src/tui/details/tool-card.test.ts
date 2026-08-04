import { describe, expect, it } from 'vitest';
import { buildToolCardModel, redactToolText } from './tool-card.js';
import { getDetailsPreferences, parseDetailsPreference, setDetailsPreference } from './preferences.js';

describe('tool card details', () => {
  it('builds safe status and summaries', () => {
    const model = buildToolCardModel({
      toolName: 'shell-exec',
      args: { command: 'ls', token: 'secret' },
      result: { ok: true },
      duration: 42,
    });
    expect(model.status).toBe('success');
    expect(model.durationLabel).toBe('42ms');
    expect(model.argumentsSummary).toContain('token');
  });

  it('redacts keys, bearer tokens, cookies, and ids', () => {
    const text = redactToolText(
      'Bearer abc.def.ghi Cookie: session=abc api_key=123 sk_test_123456789 adad9243-955c-42d1-a876-4c806e554679',
    );
    expect(text).toContain('Bearer [redacted]');
    expect(text).toContain('Cookie: [redacted]');
    expect(text).toContain('api_key=[redacted]');
    expect(text).toContain('[secret]');
    expect(text).toContain('[id]');
  });

  it('marks failed and blocked cards distinctly', () => {
    expect(buildToolCardModel({ toolName: 'http', isError: true, result: 'boom' }).status).toBe('failed');
    expect(buildToolCardModel({ toolName: 'shell', blocked: true }).status).toBe('blocked');
  });

  it('parses and stores session details preferences', () => {
    expect(parseDetailsPreference('tools expanded')).toEqual({ section: 'tools', mode: 'expanded' });
    setDetailsPreference('tools', 'expanded');
    expect(getDetailsPreferences().tools).toBe('expanded');
  });
});
