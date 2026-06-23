import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  buildKakaoTalkResponse,
  KakaoTalkAdapter,
  parseKakaoTalkInbound,
  verifyKakaoTalkWebhook,
} from './kakaotalk-adapter.js';

const SAMPLE_PAYLOAD = {
  userRequest: {
    callbackId: 'cb-123',
    utterance: '안녕하세요',
    user: {
      id: 'kakao-user-1',
      type: 'botUserKey',
      properties: { nickname: 'Minji' },
    },
  },
};

describe('KakaoTalkAdapter', () => {
  function adapter(): KakaoTalkAdapter {
    return new KakaoTalkAdapter(true, 'api-key', 'bot-id', 'webhook-secret');
  }

  it('parseInbound extracts utterance and user fields', () => {
    const message = adapter().parseInbound(SAMPLE_PAYLOAD);

    expect(message?.channel).toBe('kakaotalk');
    expect(message?.id).toBe('cb-123');
    expect(message?.externalUserId).toBe('kakao-user-1');
    expect(message?.conversationId).toBe('kakao-user-1');
    expect(message?.text).toBe('안녕하세요');
    expect(message?.isDirect).toBe(true);
    expect(message?.isMention).toBe(false);
    expect(message?.senderName).toBe('Minji');
  });

  it('parseInbound treats slash-prefixed utterances as commands', () => {
    const payload = structuredClone(SAMPLE_PAYLOAD);
    payload.userRequest.utterance = '/help';

    const message = parseKakaoTalkInbound(payload);
    expect(message?.isCommand).toBe(true);
  });

  it('sendMessage buffers replies and drainReply returns buffered text', async () => {
    const kt = adapter();
    await kt.sendMessage('kakao-user-1', 'Buffered reply');

    expect(kt.drainReply('kakao-user-1')).toBe('Buffered reply');
    expect(kt.drainReply('kakao-user-1')).toBe('');
  });

  it('buildKakaoTalkResponse returns KakaoTalk skill JSON structure', () => {
    expect(buildKakaoTalkResponse('Hello from Carina')).toEqual({
      version: '2.0',
      template: {
        outputs: [{ simpleText: { text: 'Hello from Carina' } }],
      },
    });
  });

  it('buildKakaoTalkResponse splits long replies into multiple simpleText outputs', () => {
    const response = buildKakaoTalkResponse('a'.repeat(1500));
    expect(response.template.outputs.length).toBe(2);
    expect(response.template.outputs.every((output) => output.simpleText.text.length <= 1000)).toBe(true);
  });

  it('validateWebhook verifies HMAC signature when secret is configured', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    const signature = crypto.createHmac('sha256', 'webhook-secret').update(rawBody).digest('hex');

    expect(verifyKakaoTalkWebhook(rawBody, 'webhook-secret', signature)).toBe(true);
    expect(adapter().validateWebhook({
      headers: { 'x-kakaotalk-signature': signature },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });
});
