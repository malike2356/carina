import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { httpTool } from './http.js';

const originalEnabled = process.env.LABYRINTH_ENABLED;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env.LABYRINTH_ENABLED = 'false';
});

afterEach(() => {
  process.env.LABYRINTH_ENABLED = originalEnabled;
});

const exec = (params: Record<string, unknown>) => httpTool.execute(params);

describe('http-request security', () => {
  it('rejects non-https URLs', async () => {
    await expect(exec({ method: 'GET', url: 'http://example.com' })).rejects.toThrow(
      'Only https://',
    );
  });

  it('rejects invalid URLs', async () => {
    await expect(exec({ method: 'GET', url: 'not-a-url' })).rejects.toThrow('Invalid URL');
  });

  it('blocks localhost', async () => {
    await expect(exec({ method: 'GET', url: 'https://localhost/secret' })).rejects.toThrow(
      'internal',
    );
  });

  it('blocks 127.0.0.1', async () => {
    await expect(exec({ method: 'GET', url: 'https://127.0.0.1/secret' })).rejects.toThrow(
      'internal',
    );
  });

  it('blocks RFC1918 10.x.x.x', async () => {
    await expect(exec({ method: 'GET', url: 'https://10.0.0.1/api' })).rejects.toThrow(
      'internal',
    );
  });

  it('blocks RFC1918 192.168.x.x', async () => {
    await expect(exec({ method: 'GET', url: 'https://192.168.1.1/' })).rejects.toThrow(
      'internal',
    );
  });

  it('blocks RFC1918 172.16.x.x', async () => {
    await expect(exec({ method: 'GET', url: 'https://172.16.0.1/' })).rejects.toThrow(
      'internal',
    );
  });

  it('allows legitimate external HTTPS URL', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => '{"result":"ok"}',
      headers: { forEach: (_cb: (v: string, k: string) => void) => {} },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
    const result = await exec({ method: 'GET', url: 'https://api.example.com/data' });
    expect(result).toMatchObject({ status: 200, body: '{"result":"ok"}' });
  });

  it('truncates large response bodies', async () => {
    const bigBody = 'x'.repeat(60 * 1024);
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => bigBody,
      headers: { forEach: (_cb: (v: string, k: string) => void) => {} },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
    const result = (await exec({ method: 'GET', url: 'https://api.example.com/big' })) as {
      body: string;
    };
    expect(result.body).toContain('[truncated');
    expect(result.body.length).toBeLessThan(bigBody.length);
  });
});

describe('LABYRINTH_ENABLED=false', () => {
  it('http tool skips egress check when flag is false', async () => {
    process.env.LABYRINTH_ENABLED = 'false';
    const mockResponse = {
      ok: true,
      status: 200,
      text: async () => '{"ok":true}',
      headers: { forEach: (_cb: (v: string, k: string) => void) => {} },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
    const result = await exec({ method: 'GET', url: 'https://evil.com/data' });
    expect(result).toMatchObject({ status: 200, body: '{"ok":true}' });
  });
});

describe('LABYRINTH_ENABLED=true', () => {
  beforeEach(() => {
    process.env.LABYRINTH_ENABLED = 'true';
  });

  it('blocks requests to domains not on the allowlist', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await exec({ method: 'GET', url: 'https://evil.com/steal' });
    expect(result).toMatchObject({
      error: 'Request blocked by Labyrinth Egress Filter: domain not in allowlist',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks outbound body containing sensitive credentials', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const openAiKey = 'sk-' + 'A'.repeat(48);
    const result = await exec({
      method: 'POST',
      url: 'https://api.openai.com/v1/chat',
      body: JSON.stringify({ key: openAiKey }),
    });
    expect(result).toMatchObject({
      error: 'Request blocked: outbound body contains sensitive credentials',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
