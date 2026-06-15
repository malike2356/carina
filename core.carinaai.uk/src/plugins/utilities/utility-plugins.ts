import fs from 'fs/promises';
import path from 'path';
import type { Tool } from '../../types/index.js';
import { estimateTokensFromText } from '../../hosted/ai-platform-models.js';
import { llm } from '../../brain/llm.js';
import { encodeFilePayload, decodeFilePayload } from '../../infrastructure/node-host/file-transfer.js';
import { dispatchNodeShellCommand, nodeHostRoutesEnabled } from '../../infrastructure/node-host/routes.js';
import { waitForNodeCommand } from '../../infrastructure/node-host/store.js';
import { phoneControlTool } from '../../tools/phone-control.js';

const MEMORY_WIKI_DIR = () => path.join(process.env.CARINA_HOME ?? path.join(process.env.HOME ?? '/tmp', '.carina'), 'memory-wiki');

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractReadableText(url: string): Promise<{ title?: string; text: string }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Carina/web-readability' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const article = html.match(/<article[\s\S]*?<\/article>/i)?.[0]
    ?? html.match(/<main[\s\S]*?<\/main>/i)?.[0]
    ?? html;
  return { title, text: stripHtml(article).slice(0, 50_000) };
}

export const activeMemoryTool: Tool = {
  name: 'active-memory',
  description: 'Surface relevant durable memory (user profile, agent notes) and recent session snippets for a query.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to recall' },
      limit: { type: 'number', description: 'Max session hits (default 3)' },
    },
    required: ['query'],
  },
  execute: async (params) => {
    const query = String(params.query ?? '').trim();
    if (!query) return { error: 'query is required' };
    const limit = Math.min(Math.max(Number(params.limit ?? 3), 1), 10);
    const { listPersistentFacts } = await import('../../memory/persistent-memory.js');
    const { searchSessionsAdvanced } = await import('../../memory/session-search-service.js');
    const { searchMemoryScope } = await import('../../memory/session-scope.js');
    const [userFacts, agentFacts, sessions] = await Promise.all([
      listPersistentFacts('user'),
      listPersistentFacts('memory'),
      searchSessionsAdvanced({
        query,
        limit,
        tenantScope: searchMemoryScope(),
        enableSemantic: true,
      }),
    ]);
    const needle = query.toLowerCase();
    const match = (text: string) => text.toLowerCase().includes(needle);
    return {
      userFacts: userFacts.filter((f) => match(f.content)).map((f) => f.content),
      agentNotes: agentFacts.filter((f) => match(f.content)).map((f) => f.content),
      sessions: sessions.results.map((r) => ({
        sessionId: r.sessionId,
        title: r.title,
        snippet: r.snippet,
        lineageRoot: r.lineageRoot,
      })),
    };
  },
};

export const documentExtractTool: Tool = {
  name: 'document-extract',
  description: 'Extract plain text from a local file (txt, md, html, json, csv).',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or workspace-relative file path' },
      max_chars: { type: 'number', description: 'Truncate output (default 20000)' },
    },
    required: ['path'],
  },
  execute: async (params) => {
    const filePath = path.resolve(String(params.path ?? ''));
    const maxChars = Math.min(Math.max(Number(params.max_chars ?? 20_000), 500), 100_000);
    const ext = path.extname(filePath).toLowerCase();
    const raw = await fs.readFile(filePath, 'utf8').catch(() => null);
    if (raw === null) return { error: `Cannot read file: ${filePath}` };
    let text = raw;
    if (ext === '.html' || ext === '.htm') text = stripHtml(raw);
    if (ext === '.json') {
      try {
        text = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        // keep raw
      }
    }
    return {
      path: filePath,
      format: ext || 'plain',
      length: text.length,
      text: text.slice(0, maxChars),
      truncated: text.length > maxChars,
    };
  },
};

export const webReadabilityTool: Tool = {
  name: 'web-readability',
  description: 'Fetch a public HTTPS page and return readable article text (no scripts).',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string' } },
    required: ['url'],
  },
  dangerous: true,
  execute: async (params) => {
    const url = String(params.url ?? '').trim();
    if (!url.startsWith('https://')) return { error: 'Only https:// URLs are supported' };
    try {
      const { title, text } = await extractReadableText(url);
      return { url, title, text, length: text.length };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

export const fileTransferTool: Tool = {
  name: 'file-transfer',
  description: 'Encode or decode node file payloads for paired device transfer (base64, size-bounded).',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['encode', 'decode', 'push'] },
      path: { type: 'string', description: 'Local path for encode/push' },
      content_base64: { type: 'string', description: 'Payload for decode' },
      node_id: { type: 'string', description: 'Target node for push' },
      remote_path: { type: 'string', description: 'Destination path on node when pushing' },
    },
    required: ['action'],
  },
  dangerous: true,
  execute: async (params) => {
    const action = String(params.action ?? '');
    if (action === 'encode') {
      const filePath = path.resolve(String(params.path ?? ''));
      const buf = await fs.readFile(filePath);
      return encodeFilePayload(buf);
    }
    if (action === 'decode') {
      const buf = decodeFilePayload(String(params.content_base64 ?? ''));
      return { size: buf.length, textPreview: buf.toString('utf8').slice(0, 500) };
    }
    if (action === 'push') {
      if (!nodeHostRoutesEnabled()) return { error: 'Node host not enabled' };
      const nodeId = String(params.node_id ?? process.env.CARINA_PHONE_NODE_ID ?? '').trim();
      if (!nodeId) return { error: 'node_id required' };
      const filePath = path.resolve(String(params.path ?? ''));
      const remotePath = String(params.remote_path ?? path.basename(filePath));
      const buf = await fs.readFile(filePath);
      const payload = encodeFilePayload(buf);
      const cmd = dispatchNodeShellCommand(nodeId, `mkdir -p "$(dirname '${remotePath.replace(/'/g, "'\\''")}')"`);
      await waitForNodeCommand(cmd.id, 30_000);
      return { nodeId, remotePath, ...payload, status: 'queued', commandId: cmd.id };
    }
    return { error: `Unknown action: ${action}` };
  },
};

export const bonjourDiscoveryTool: Tool = {
  name: 'bonjour-discovery',
  description:
    'List configured Carina gateway hosts (Bonjour/mDNS auto-discovery is optional; set CARINA_GATEWAY_HOSTS or use manual pairing).',
  parameters: {
    type: 'object',
    properties: {
      service: { type: 'string', description: 'Service type filter (default _carina._tcp)' },
    },
  },
  execute: async (params) => {
    const service = String(params.service ?? '_carina._tcp');
    const configured = (process.env.CARINA_GATEWAY_HOSTS ?? process.env.CARINA_OPERATOR_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    return {
      service,
      mode: process.env.CARINA_BONJOUR_ENABLED === 'true' ? 'bonjour' : 'configured-hosts',
      note: 'Native mDNS browse requires CARINA_BONJOUR_ENABLED=true and a local Bonjour stack.',
      hosts: configured,
      count: configured.length,
    };
  },
};

export const tokenjuiceTool: Tool = {
  name: 'tokenjuice',
  description: 'Estimate token counts for text (chars/4 heuristic) and compare against a budget.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      budget: { type: 'number', description: 'Optional max tokens to compare against' },
    },
    required: ['text'],
  },
  execute: async (params) => {
    const text = String(params.text ?? '');
    const tokens = estimateTokensFromText(text);
    const budget = params.budget !== undefined ? Number(params.budget) : undefined;
    return {
      characters: text.length,
      estimatedTokens: tokens,
      budget,
      withinBudget: budget !== undefined ? tokens <= budget : undefined,
      headroom: budget !== undefined ? Math.max(0, budget - tokens) : undefined,
    };
  },
};

export const memoryWikiTool: Tool = {
  name: 'memory-wiki',
  description: 'CRUD markdown pages in the memory wiki store (~/.carina/memory-wiki).',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'get', 'write', 'delete'] },
      slug: { type: 'string', description: 'Page slug (kebab-case)' },
      content: { type: 'string' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const dir = MEMORY_WIKI_DIR();
    await fs.mkdir(dir, { recursive: true });
    const action = String(params.action ?? '');
    if (action === 'list') {
      const files = await fs.readdir(dir);
      return { pages: files.filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')) };
    }
    const slug = String(params.slug ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!slug) return { error: 'slug is required' };
    const file = path.join(dir, `${slug}.md`);
    if (action === 'get') {
      try {
        const content = await fs.readFile(file, 'utf8');
        return { slug, content };
      } catch {
        return { error: `Page not found: ${slug}` };
      }
    }
    if (action === 'write') {
      const content = String(params.content ?? '');
      await fs.writeFile(file, content, 'utf8');
      return { slug, status: 'saved', length: content.length };
    }
    if (action === 'delete') {
      await fs.rm(file, { force: true });
      return { slug, status: 'deleted' };
    }
    return { error: `Unknown action: ${action}` };
  },
};

export const skillWorkshopTool: Tool = {
  name: 'skill-workshop',
  description: 'Review auto-captured skill drafts (requires CARINA_SKILL_WORKSHOP=true).',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'approve', 'reject', 'status'] },
      id: { type: 'string' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const {
      workshopReviewEnabled,
      listWorkshopDrafts,
      approveWorkshopDraft,
      rejectWorkshopDraft,
    } = await import('../../skills/workshop-store.js');
    const action = String(params.action ?? '');
    if (action === 'status') {
      return { enabled: workshopReviewEnabled(), env: 'CARINA_SKILL_WORKSHOP' };
    }
    if (!workshopReviewEnabled()) {
      return { error: 'Skill workshop disabled. Set CARINA_SKILL_WORKSHOP=true.' };
    }
    if (action === 'list') {
      const drafts = listWorkshopDrafts('pending');
      return {
        count: drafts.length,
        drafts: drafts.map((d) => ({
          id: d.id,
          name: d.name,
          source: d.source,
          createdAt: d.createdAt,
        })),
      };
    }
    const id = String(params.id ?? '').trim();
    if (!id) return { error: 'id is required' };
    if (action === 'approve') {
      const result = await approveWorkshopDraft(id);
      return { status: 'approved', action: result.action, draft: result.draft };
    }
    if (action === 'reject') {
      const draft = await rejectWorkshopDraft(id);
      return { status: 'rejected', draft };
    }
    return { error: `Unknown action: ${action}` };
  },
};

export const llmTaskTool: Tool = {
  name: 'llm-task',
  description: 'Run a one-shot LLM completion without the full agent tool loop.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      system: { type: 'string' },
      max_tokens: { type: 'number' },
    },
    required: ['prompt'],
  },
  execute: async (params) => {
    const prompt = String(params.prompt ?? '').trim();
    if (!prompt) return { error: 'prompt is required' };
    const system = String(params.system ?? 'You are a helpful assistant. Be concise.');
    const response = await llm.chat([
      { role: 'system', content: system, timestamp: new Date() },
      { role: 'user', content: prompt, timestamp: new Date() },
    ]);
    const text = response.content ?? '';
    const max = Number(params.max_tokens ?? 0);
    return {
      content: max > 0 ? text.slice(0, max * 4) : text,
      provider: llm.current().name,
      model: llm.currentModel(),
    };
  },
};

export const BUILTIN_UTILITY_TOOLS: Record<string, Tool> = {
  'active-memory': activeMemoryTool,
  'document-extract': documentExtractTool,
  'web-readability': webReadabilityTool,
  'file-transfer': fileTransferTool,
  'phone-control': phoneControlTool,
  'bonjour-discovery': bonjourDiscoveryTool,
  tokenjuice: tokenjuiceTool,
  'memory-wiki': memoryWikiTool,
  'skill-workshop': skillWorkshopTool,
  'llm-task': llmTaskTool,
};

export const UTILITY_PLUGIN_IDS = Object.keys(BUILTIN_UTILITY_TOOLS);
