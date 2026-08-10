import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  invokeKeprixAgentRun,
  messageNeedsCarinaNativeTools,
  resolveEngineName,
  resolveKeprixProductForChat,
  resolveWorkspaceIdForChat,
  shouldRouteChatThroughKeprix,
} from './chat-engine.js';
import { resetAgentEngineStateForTests } from './store.js';

describe('agent-engine chat routing (CAS-06)', () => {
  let prevHome: string | undefined;
  let tmpHome: string;

  beforeEach(() => {
    prevHome = process.env.CARINA_HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-chat-engine-'));
    process.env.CARINA_HOME = tmpHome;
    process.env.CARINA_DATA_DIR = path.join(tmpHome, 'data');
    delete process.env.CARINA_FORCE_CARINA_ENGINE;
    delete process.env.CARINA_KEPRIX_CHAT_PRIMARY;
    resetAgentEngineStateForTests({
      config: {
        global_engine: 'keprix',
        keprix_url: 'http://127.0.0.1:9',
        default_model: 'deepseek-v4-pro',
        max_iterations: 10,
        timeout_seconds: 30,
        prompt_filter_enabled: true,
        kill_switch_enabled: true,
        scout_integration_enabled: true,
      },
      workspaces: {
        ws_keprix: { name: 'K', engine: 'keprix', status: 'active' },
        ws_carina: { name: 'C', engine: 'carina', status: 'active' },
      },
    });
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    delete process.env.CARINA_DATA_DIR;
    delete process.env.CARINA_FORCE_CARINA_ENGINE;
    delete process.env.CARINA_KEPRIX_CHAT_PRIMARY;
    delete process.env.CARINA_KEPRIX_SHARED_TOKEN;
    try {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('resolves workspace id from cloud client session', () => {
    expect(resolveWorkspaceIdForChat({
      clientSessionId: 'cloud:ws_abc:sess-1',
    })).toBe('ws_abc');
  });

  it('prefers tenantId over cloud session parse', () => {
    expect(resolveWorkspaceIdForChat({
      tenantId: 'tenant-1',
      clientSessionId: 'cloud:ws_abc:sess-1',
    })).toBe('tenant-1');
  });

  it('picks aiva product for cloud / worker chats', () => {
    expect(resolveKeprixProductForChat({ clientSessionId: 'cloud:ws:s' })).toBe('aiva');
    expect(resolveKeprixProductForChat({ workerPresent: true })).toBe('aiva');
    expect(resolveKeprixProductForChat({ sessionId: 'local-op' })).toBe('carina');
  });

  it('honours workspace engine overrides and force-carina', () => {
    expect(resolveEngineName('ws_keprix')).toBe('keprix');
    expect(resolveEngineName('ws_carina')).toBe('carina');
    expect(resolveEngineName('unknown')).toBe('keprix');
    expect(shouldRouteChatThroughKeprix('ws_carina')).toBe(false);
    expect(shouldRouteChatThroughKeprix('ws_keprix')).toBe(true);

    process.env.CARINA_FORCE_CARINA_ENGINE = 'true';
    expect(shouldRouteChatThroughKeprix('ws_keprix')).toBe(false);

    delete process.env.CARINA_FORCE_CARINA_ENGINE;
    process.env.CARINA_KEPRIX_CHAT_PRIMARY = 'false';
    expect(shouldRouteChatThroughKeprix('ws_keprix')).toBe(false);
  });

  it('flags lead/CRM/Companies House asks for Carina native tools', () => {
    expect(messageNeedsCarinaNativeTools(
      'find me 10 businesses in Portsmouth and save leads to CRM',
    )).toBe(true);
    expect(messageNeedsCarinaNativeTools('search Companies House for bakeries')).toBe(true);
    expect(messageNeedsCarinaNativeTools('What is the most recent email I have received?')).toBe(true);
    expect(messageNeedsCarinaNativeTools('find Oluwatobi Fajana')).toBe(true);
    expect(messageNeedsCarinaNativeTools('hi, how are you?')).toBe(false);
  });

  it('invokeKeprixAgentRun fails closed without token', async () => {
    delete process.env.CARINA_KEPRIX_SHARED_TOKEN;
    const result = await invokeKeprixAgentRun({
      workspaceId: 'ws_keprix',
      sessionId: 's1',
      message: 'hello',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/SHARED_TOKEN/);
  });

  it('invokeKeprixAgentRun parses assistant text on success', async () => {
    process.env.CARINA_KEPRIX_SHARED_TOKEN = 'test-token';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        ok: true,
        result: {
          message: { role: 'assistant', content: 'Hello from Keprix' },
          finish_reason: 'stop',
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await invokeKeprixAgentRun({
      workspaceId: 'ws_keprix',
      sessionId: 's1',
      message: 'hi',
      product: 'aiva',
      systemPrompt: 'You are Aiva',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe('Hello from Keprix');
      expect(result.product).toBe('aiva');
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/v1/products/aiva/invoke');
    expect(String((init as RequestInit).headers && (init as RequestInit))).toBeTruthy();
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.node).toBe('agent.run');
    expect(body.workspace_id).toBe('ws_keprix');
    expect(body.input.messages[0].content).toBe('hi');
    fetchMock.mockRestore();
  });

  it('invokeKeprixAgentRun returns failure on HTTP error for Carina fallback', async () => {
    process.env.CARINA_KEPRIX_SHARED_TOKEN = 'test-token';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: { error: 'force_carina' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await invokeKeprixAgentRun({
      workspaceId: 'ws_keprix',
      sessionId: 's1',
      message: 'hi',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toMatch(/503/);
    }
    fetchMock.mockRestore();
  });
});
