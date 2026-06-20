import { describe, expect, it } from 'vitest';
import {
  cleanTextForTelegramSpeech,
  stripSpeakDirective,
  wantsSpokenReply,
} from './telegram-audio.js';

describe('telegram-audio voice detection', () => {
  it('detects /speak and [speak]', () => {
    expect(wantsSpokenReply('/speak hello')).toBe(true);
    expect(wantsSpokenReply('weather [speak]')).toBe(true);
  });

  it('detects natural voice requests', () => {
    expect(wantsSpokenReply('weather in Portsmouth - respond in audio voice')).toBe(true);
    expect(wantsSpokenReply('tell me the time in voice')).toBe(true);
    expect(wantsSpokenReply('read this as audio')).toBe(true);
  });

  it('ignores plain text without voice intent', () => {
    expect(wantsSpokenReply('weather in Portsmouth')).toBe(false);
    expect(wantsSpokenReply('hi carina')).toBe(false);
  });

  it('strips voice directives but keeps the task', () => {
    expect(stripSpeakDirective('weather in Portsmouth - respond in audio voice')).toBe(
      'weather in Portsmouth',
    );
    expect(stripSpeakDirective('/speak hello there')).toBe('hello there');
  });

  it('cleans tool markers for speech', () => {
    expect(cleanTextForTelegramSpeech('Hi\n[using web-search...]\nIt is 13C.')).toBe(
      'Hi It is 13C.',
    );
  });
});
