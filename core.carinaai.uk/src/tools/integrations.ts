import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';
import { channelRegistry as registry } from '../gateway/channels/channel-registry.js';
import { webSearchTool } from './web-search.js';

async function homeassistantCall(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
): Promise<unknown> {
  const base = process.env.HOMEASSISTANT_URL ?? '';
  const token = process.env.HOMEASSISTANT_TOKEN ?? '';
  if (!base || !token) {
    return { error: 'Set HOMEASSISTANT_URL and HOMEASSISTANT_TOKEN' };
  }

  const url = `${base.replace(/\/$/, '')}/api${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

export const homeassistantTool: Tool = {
  name: 'homeassistant',
  description: 'Control Home Assistant devices and read states via REST API.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['states', 'state', 'call_service', 'services'] },
      entity_id: { type: 'string' },
      domain: { type: 'string' },
      service: { type: 'string' },
      service_data: { type: 'object' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'states') return homeassistantCall('/states');
    if (action === 'services') return homeassistantCall('/services');

    if (action === 'state') {
      const entityId = String(params.entity_id ?? '').trim();
      if (!entityId) return { error: 'entity_id is required' };
      return homeassistantCall(`/states/${encodeURIComponent(entityId)}`);
    }

    if (action === 'call_service') {
      const domain = String(params.domain ?? '').trim();
      const service = String(params.service ?? '').trim();
      if (!domain || !service) return { error: 'domain and service are required' };
      const data = (params.service_data ?? {}) as Record<string, unknown>;
      if (params.entity_id) data.entity_id = String(params.entity_id);
      return homeassistantCall(`/services/${domain}/${service}`, 'POST', data);
    }

    return { error: `unknown action: ${action}` };
  },
};

export const xPostTool: Tool = {
  name: 'x-post',
  dangerous: true,
  description: 'Post a tweet to X/Twitter. Requires X_BEARER_TOKEN and X_API_KEY/X_API_SECRET or OAuth user context.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Tweet text (max 280 chars)' },
    },
    required: ['text'],
  },
  requiresConfirmation: true,
  execute: async (params) => {
    const text = String(params.text ?? '').trim().slice(0, 280);
    if (!text) return { error: 'text is required' };

    const bearer = process.env.X_BEARER_TOKEN ?? '';
    if (!bearer) return { error: 'Set X_BEARER_TOKEN for posting' };

    try {
      const response = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json();
      return { source: 'x_api', status: response.status, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `X post failed: ${msg}` };
    }
  },
};

export const xSearchTool: Tool = {
  name: 'x-search',
  description: 'Search X/Twitter posts. Uses X API v2 when X_BEARER_TOKEN is set, otherwise falls back to web search.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      max_results: { type: 'number', description: 'Max tweets (default 10)' },
    },
    required: ['query'],
  },
  execute: async (params) => {
    const query = String(params.query ?? '').trim();
    const maxResults = Math.max(1, Math.min(Number(params.max_results ?? 10), 50));
    if (!query) return { error: 'query is required' };

    const bearer = process.env.X_BEARER_TOKEN ?? '';
    if (bearer) {
      try {
        const url = new URL('https://api.twitter.com/2/tweets/search/recent');
        url.searchParams.set('query', query);
        url.searchParams.set('max_results', String(maxResults));
        url.searchParams.set('tweet.fields', 'created_at,author_id,public_metrics');

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${bearer}` },
          signal: AbortSignal.timeout(15_000),
        });
        const data = await response.json();
        return { source: 'x_api', status: response.status, data };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: `X API failed: ${msg}` };
      }
    }

    const fallback = await webSearchTool.execute({
      query: `site:twitter.com OR site:x.com ${query}`,
      count: maxResults,
    });
    return { source: 'web_search_fallback', results: fallback };
  },
};

export const discordTool: Tool = {
  name: 'discord',
  description: 'Send messages to Discord channels via the configured bot.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['send', 'status'] },
      channel_id: { type: 'string', description: 'Discord channel ID' },
      text: { type: 'string' },
      thread_id: { type: 'string' },
    },
    required: ['action'],
  },
  needsConfirmation: (params) => String(params.action) === 'send',
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'status') {
      const adapter = registry.getByName('discord');
      return {
        enabled: adapter?.enabled ?? false,
        configured: Boolean(config.discord.botToken),
      };
    }

    const channelId = String(params.channel_id ?? '').trim();
    const text = String(params.text ?? '').trim();
    if (!channelId || !text) return { error: 'channel_id and text are required' };

    const adapter = registry.getByName('discord');
    if (!adapter?.enabled) return { error: 'Discord gateway not enabled' };

    await adapter.sendMessage(channelId, text, {
      threadId: params.thread_id ? String(params.thread_id) : undefined,
    });
    return { sent: true, channel_id: channelId };
  },
};

export const feishuDocTool: Tool = {
  name: 'feishu-doc',
  description: 'Read Feishu/Lark document content. Requires FEISHU_APP_ID and FEISHU_APP_SECRET.',
  parameters: {
    type: 'object',
    properties: {
      document_id: { type: 'string', description: 'Feishu document token/ID' },
    },
    required: ['document_id'],
  },
  execute: async (params) => {
    const appId = process.env.FEISHU_APP_ID ?? '';
    const appSecret = process.env.FEISHU_APP_SECRET ?? '';
    if (!appId || !appSecret) {
      return { error: 'Set FEISHU_APP_ID and FEISHU_APP_SECRET' };
    }

    const docId = String(params.document_id ?? '').trim();
    if (!docId) return { error: 'document_id is required' };

    try {
      const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
      const tokenData = await tokenRes.json() as { tenant_access_token?: string };
      const token = tokenData.tenant_access_token;
      if (!token) return { error: 'Failed to obtain Feishu tenant token' };

      const docRes = await fetch(
        `https://open.feishu.cn/open-apis/docx/v1/documents/${docId}/raw_content`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const content = await docRes.json();
      return { document_id: docId, content };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `Feishu API failed: ${msg}` };
    }
  },
};

export const yuanbaoTool: Tool = {
  name: 'yuanbao',
  description:
    'Query Tencent Hunyuan/Yuanbao when HUNYUAN_API_KEY is set, otherwise search the web for Yuanbao-related context.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Question or prompt' },
    },
    required: ['prompt'],
  },
  execute: async (params) => {
    const prompt = String(params.prompt ?? '').trim();
    if (!prompt) return { error: 'prompt is required' };

    const apiKey = process.env.HUNYUAN_API_KEY ?? process.env.YUANBAO_API_KEY ?? '';
    if (apiKey) {
      try {
        const response = await fetch('https://api.hunyuan.cloud.tencent.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.HUNYUAN_MODEL ?? 'hunyuan-lite',
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: AbortSignal.timeout(30_000),
        });
        const data = await response.json();
        return { source: 'hunyuan_api', status: response.status, data };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: `Hunyuan API failed: ${msg}` };
      }
    }

    const fallback = await webSearchTool.execute({ query: `Tencent Yuanbao ${prompt}` });
    return { source: 'web_search_fallback', results: fallback };
  },
};

export const feishuDriveTool: Tool = {
  name: 'feishu-drive',
  description: 'List files in Feishu/Lark drive. Requires FEISHU_APP_ID and FEISHU_APP_SECRET.',
  parameters: {
    type: 'object',
    properties: {
      folder_token: { type: 'string', description: 'Folder token (optional)' },
    },
  },
  execute: async (params) => {
    const appId = process.env.FEISHU_APP_ID ?? '';
    const appSecret = process.env.FEISHU_APP_SECRET ?? '';
    if (!appId || !appSecret) {
      return { error: 'Set FEISHU_APP_ID and FEISHU_APP_SECRET' };
    }

    try {
      const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
      const tokenData = await tokenRes.json() as { tenant_access_token?: string };
      const token = tokenData.tenant_access_token;
      if (!token) return { error: 'Failed to obtain Feishu tenant token' };

      const folder = params.folder_token ? String(params.folder_token) : '';
      const url = folder
        ? `https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${folder}`
        : 'https://open.feishu.cn/open-apis/drive/v1/files';

      const listRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await listRes.json();
      return { files: data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: `Feishu drive API failed: ${msg}` };
    }
  },
};
