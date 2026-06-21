import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createScoutProxyRouter, _setProxyDeps } from '../scout-proxy.js';

const fetchMock = vi.fn();

describe('scout proxy', () => {
  beforeEach(() => {
    process.env.SCOUT_PROXY_KEY = 'proxy-key';
    fetchMock.mockReset();
    _setProxyDeps({
      scanUserMessage: async () => ({ blocked: false }),
      isAllowed: () => true,
      checkApiKey: vi.fn().mockResolvedValue(true),
      checkResponse: vi.fn().mockResolvedValue(undefined),
      logEvent: vi.fn().mockResolvedValue(undefined),
      fetchFn: fetchMock as unknown as typeof fetch,
    });
  });

  it('forwards requests and preserves streaming responses', async () => {
    const encoder = new TextEncoder();
    fetchMock.mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"ok":true}\n\n'));
        controller.close();
      },
    }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));

    const app = express();
    app.use(express.json());
    app.use('/', createScoutProxyRouter({ agentType: 'openai' }));

    const res = await request(app)
      .post('/v1/chat/completions')
      .set('X-Scout-Proxy-Key', 'proxy-key')
      .send({ messages: [{ role: 'user', content: 'hello' }], stream: true });

    expect(res.status).toBe(200);
    expect(res.text).toContain('data: {"ok":true}');
    expect(fetchMock).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
  });
});
