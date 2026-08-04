import { describe, expect, it } from 'vitest';
import {
  cleanTextForTelegramSpeech,
  prefersTelegramVoiceReplies,
  shouldSendTelegramVoiceReply,
  stripSpeakDirective,
  wantsNarrativeSpeakIntent,
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
    expect(wantsSpokenReply('summary in audio format - not text')).toBe(true);
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
    expect(
      stripSpeakDirective(
        'give me summary of boreholes in my drive and i need the response in audio format - not text. put it here in telegram',
      ),
    ).toBe('give me summary of boreholes in my drive');
    expect(
      stripSpeakDirective('summarise my google drive content to me here in voice audio'),
    ).toBe('summarise my google drive content to me');
  });

  it('detects narrative speak intents without audio wording', () => {
    expect(wantsNarrativeSpeakIntent('summarise my google drive content')).toBe(true);
    expect(wantsNarrativeSpeakIntent('tell me about boreholes in my drive')).toBe(true);
    expect(wantsNarrativeSpeakIntent('read me the latest notes')).toBe(true);
    expect(wantsNarrativeSpeakIntent('hello')).toBe(false);
  });

  it('auto-sends voice when prefer-on and narrative or long reply', () => {
    expect(
      shouldSendTelegramVoiceReply({
        preferVoiceReplies: true,
        inboundText: 'summarise my google drive',
        replyText: 'Short.',
      }),
    ).toBe(true);
    expect(
      shouldSendTelegramVoiceReply({
        preferVoiceReplies: true,
        inboundText: 'hello',
        replyText: 'x'.repeat(280),
      }),
    ).toBe(true);
    expect(
      shouldSendTelegramVoiceReply({
        preferVoiceReplies: false,
        inboundText: 'summarise my google drive',
        replyText: 'x'.repeat(400),
      }),
    ).toBe(false);
    expect(
      shouldSendTelegramVoiceReply({
        preferVoiceReplies: false,
        inboundText: 'hello',
        replyText: 'x'.repeat(400),
        explicitVoiceRequested: true,
      }),
    ).toBe(true);
  });

  it('defaults prefer voice replies to off', () => {
    expect(prefersTelegramVoiceReplies(undefined)).toBe(false);
    expect(prefersTelegramVoiceReplies({})).toBe(false);
    expect(prefersTelegramVoiceReplies({ preferVoiceReplies: true })).toBe(true);
    expect(prefersTelegramVoiceReplies({ preferVoiceReplies: false })).toBe(false);
  });
});
