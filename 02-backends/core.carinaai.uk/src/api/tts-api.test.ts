import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const generateSpeechMock = vi.fn();

vi.mock('../utils/tts.js', () => ({
  generateSpeech: generateSpeechMock,
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(Buffer.from('fake-mp3')),
  },
}));

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & typeof res;
}

describe('handleTtsRequest', () => {
  beforeEach(() => {
    generateSpeechMock.mockReset();
    generateSpeechMock.mockResolvedValue({
      filePath: 'data/tts/test.mp3',
      cleanup: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('returns 400 when text is missing', async () => {
    const { handleTtsRequest } = await import('./tts-api.js');
    const res = mockRes();
    await handleTtsRequest({ body: {} } as Request, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'text is required' });
  });

  it('returns audio/mpeg for valid text', async () => {
    const { handleTtsRequest } = await import('./tts-api.js');
    const res = mockRes();
    await handleTtsRequest({ body: { text: 'Hello from Carina' } } as Request, res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('audio/mpeg');
    expect(generateSpeechMock).toHaveBeenCalledWith('Hello from Carina');
  });
});
