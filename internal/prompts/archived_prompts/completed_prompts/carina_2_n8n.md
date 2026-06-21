  You are implementing the n8n integration for the Carina AI agent.

  WORKING DIRECTORY: /opt/lampp/htdocs/verlox/carina/core.carinaai.uk

  DO NOT touch n8n itself. DO NOT add n8n as a Carina dependency. Build only the
  integration layer described below. No emojis. No em-dashes. TypeScript strict mode.

  ---

  CODEBASE ORIENTATION (read before touching any file):

  Tool shape - every tool implements the `Tool` interface from `src/types/index.js`:
    {
      name: string
      description: string
      dangerous?: boolean
      parameters: JSONSchema object
      needsConfirmation?: (params) => boolean
      execute: (params: Record<string, unknown>) => Promise<unknown>
    }

  Config pattern - add new keys to the `config` object in `src/config/index.ts`:
    n8n: {
      baseUrl: process.env.N8N_BASE_URL ?? '',
      apiKey: process.env.N8N_API_KEY ?? '',
    }

  Tool registration - after creating a tool file, import it in `src/tools/index.ts`
    and call `registry.register(yourTool)`. Follow the existing import block pattern.

  Carina API endpoint for the n8n node to call:
    POST /acp/prompt
    Body (JSON): { prompt: string, sessionId?: string, stream?: boolean }
    Auth: Authorization: Bearer <CARINA_OPS_TOKEN>  (or CARINA_WEB_PASSWORD)
    Streaming: text/event-stream, each chunk: data: {"type":"text","content":"..."}\n\n
    Non-streaming: JSON: { response: string, sessionId: string }
    Source: src/gateway/acp.ts lines 94-155 -- study this before implementing the node.

  HTTP helper pattern (from src/tools/integrations.ts):
    - Use native fetch with AbortSignal.timeout(15_000)
    - Return { status, data } on success
    - Return { error: string } on failure; never throw from execute()
    - Parse response text, then attempt JSON.parse; fall back to raw text

  Test pattern (from src/tools/http.test.ts):
    import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
    - vi.stubGlobal('fetch', vi.fn().mockResolvedValue(...)) to mock HTTP calls
    - beforeEach: set env vars and vi.restoreAllMocks()
    - afterEach: restore original env vars

  n8n REST API facts (n8n v1.x public API, requires ENABLE_PUBLIC_API=true on the n8n server):
    - GET  {baseUrl}/api/v1/workflows              - list all workflows
    - POST {baseUrl}/api/v1/workflows/{id}/run     - trigger execution (returns execution ID)
    - GET  {baseUrl}/api/v1/executions/{id}        - get execution status
    - Auth header: X-N8N-API-KEY: {apiKey}
    - For webhook-triggered workflows: POST {baseUrl}/webhook/{webhookPath}
    The 'trigger' action in the tool supports both: if workflowId looks like a UUID or
    integer, use the /run endpoint; if it contains '/' (a webhook path), POST directly
    to {baseUrl}/webhook/{workflowId}.

  ---

  PART 1: Carina n8n tool

  FILE TO CREATE: src/tools/n8n.ts

  Implement a Tool named 'n8n' that lets Carina call n8n.

  Parameters:
    action       string (required) - 'trigger' | 'status' | 'list'
    workflow_id  string (trigger)  - workflow UUID, integer ID, or webhook path
    payload      object (trigger, optional) - JSON sent as request body to the workflow
    execution_id string (status)  - n8n execution ID to check
    base_url     string (optional) - override N8N_BASE_URL for this call
    api_key      string (optional) - override N8N_API_KEY for this call

  Tool metadata:
    name: 'n8n'
    dangerous: true
    needsConfirmation: (params) => params.action === 'trigger'

  Helper function n8nFetch(path, method, body, baseUrl, apiKey):
    - Builds URL from base_url (trimmed of trailing slash)
    - Sets headers: { 'X-N8N-API-KEY': apiKey, 'Content-Type': 'application/json' }
    - Uses AbortSignal.timeout(20_000) (n8n workflows can be slow to start)
    - Returns { ok: boolean, status: number, data: unknown }

  action === 'trigger':
    const base = params.base_url || config.n8n.baseUrl
    const key  = params.api_key  || config.n8n.apiKey
    if (!base) return { error: 'N8N_BASE_URL is not set' }
    const id = String(params.workflow_id ?? '').trim()
    if (!id) return { error: 'workflow_id is required for trigger' }
    Determine endpoint:
      if id includes '/' -> POST {base}/webhook/{id} (webhook-triggered workflow)
      else               -> POST {base}/api/v1/workflows/{encodeURIComponent(id)}/run
    Body: params.payload ?? {}
    On 200/201: return { triggered: true, execution_id: data.executionId ?? null, status: data.status ?? 'running'
  }
    On 404: return { error: `workflow ${id} not found` }
    On other error: return { error: `n8n returned ${status}` }

  action === 'status':
    const base = params.base_url || config.n8n.baseUrl
    const key  = params.api_key  || config.n8n.apiKey
    if (!base) return { error: 'N8N_BASE_URL is not set' }
    const execId = String(params.execution_id ?? '').trim()
    if (!execId) return { error: 'execution_id is required for status' }
    GET {base}/api/v1/executions/{encodeURIComponent(execId)}
    On 200: return {
      execution_id: data.id,
      status: data.status,           // 'running' | 'success' | 'error' | 'waiting'
      finished: data.finished,
      started_at: data.startedAt,
      stopped_at: data.stoppedAt ?? null,
      duration_ms: data.stoppedAt && data.startedAt
        ? new Date(data.stoppedAt).getTime() - new Date(data.startedAt).getTime()
        : null,
    }
    On 404: return { error: `execution ${execId} not found` }

  action === 'list':
    const base = params.base_url || config.n8n.baseUrl
    const key  = params.api_key  || config.n8n.apiKey
    if (!base) return { error: 'N8N_BASE_URL is not set' }
    GET {base}/api/v1/workflows
    On 200: return {
      workflows: (data.data ?? []).map((w: any) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        updated_at: w.updatedAt,
      }))
    }

  ---

  PART 2: Register the tool

  FILE TO EDIT: src/tools/index.ts

  Add after the existing integrations imports (near the bottom of the import block):
    import { n8nTool } from './n8n.js';

  Add after the existing registry.register calls (keep alphabetical order near 'n'):
    registry.register(n8nTool);

  ---

  PART 3: Add config keys

  FILE TO EDIT: src/config/index.ts

  Inside the `config` export object, add after the existing `homeassistant` block:
    n8n: {
      baseUrl: process.env.N8N_BASE_URL ?? '',
      apiKey: process.env.N8N_API_KEY ?? '',
    },

  ---

  PART 4: n8n community node (separate npm package)

  DIRECTORY TO CREATE: integrations/n8n-carina-node/

  This is a self-contained package, not imported by Carina's core. It has its own
  package.json and tsconfig. Do not add its dependencies to the root package.json.

  FILE: integrations/n8n-carina-node/package.json
  {
    "name": "n8n-nodes-carina",
    "version": "0.1.0",
    "description": "n8n community node for Carina AI agent",
    "keywords": ["n8n-community-node-package"],
    "license": "MIT",
    "main": "dist/index.js",
    "scripts": {
      "build": "tsc -p tsconfig.json",
      "dev": "tsc -p tsconfig.json --watch"
    },
    "n8n": {
      "n8nNodesApiVersion": 1,
      "credentials": ["dist/credentials/CarinaApi.credentials.js"],
      "nodes": ["dist/nodes/Carina/Carina.node.js"]
    },
    "devDependencies": {
      "n8n-workflow": "^1.0.0",
      "typescript": "^5.0.0",
      "@types/node": "^22.0.0"
    }
  }

  FILE: integrations/n8n-carina-node/tsconfig.json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "commonjs",
      "lib": ["ES2022"],
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "outDir": "./dist",
      "rootDir": ".",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "resolveJsonModule": true
    },
    "include": ["nodes/**/*.ts", "credentials/**/*.ts", "index.ts"],
    "exclude": ["dist", "node_modules"]
  }

  FILE: integrations/n8n-carina-node/index.ts
  export { CarinaNode } from './nodes/Carina/Carina.node.js';
  export { CarinaApi } from './credentials/CarinaApi.credentials.js';

  FILE: integrations/n8n-carina-node/credentials/CarinaApi.credentials.ts
  import type { ICredentialType, INodeProperties } from 'n8n-workflow';

  export class CarinaApi implements ICredentialType {
    name = 'carinaApi';
    displayName = 'Carina API';
    documentationUrl = 'https://docs.carinaai.uk/developer/api';
    properties: INodeProperties[] = [
      {
        displayName: 'Base URL',
        name: 'baseUrl',
        type: 'string',
        default: 'http://localhost:3333',
        placeholder: 'https://your-carina-instance.example.com',
        description: 'URL where Carina is running. Include port if not on 80/443.',
      },
      {
        displayName: 'API Key',
        name: 'apiKey',
        type: 'string',
        typeOptions: { password: true },
        default: '',
        description: 'CARINA_OPS_TOKEN or CARINA_WEB_PASSWORD from your Carina .env file.',
      },
      {
        displayName: 'Timeout (seconds)',
        name: 'timeout',
        type: 'number',
        default: 120,
        description: 'Max seconds to wait for Carina to finish. Increase for long-running tasks.',
      },
    ];
  }

  FILE: integrations/n8n-carina-node/nodes/Carina/Carina.node.ts

  import type {
    IDataObject,
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
  } from 'n8n-workflow';
  import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

  export class CarinaNode implements INodeType {
    description: INodeTypeDescription = {
      displayName: 'Carina',
      name: 'carina',
      icon: 'file:carina.svg',
      group: ['transform'],
      version: 1,
      subtitle: '={{ $parameter["prompt"].slice(0, 60) }}',
      description: 'Send a task to Carina AI agent and get the response.',
      defaults: { name: 'Carina' },
      inputs: [NodeConnectionType.Main],
      outputs: [NodeConnectionType.Main],
      credentials: [{ name: 'carinaApi', required: true }],
      properties: [
        {
          displayName: 'Prompt',
          name: 'prompt',
          type: 'string',
          typeOptions: { rows: 4 },
          required: true,
          default: '',
          placeholder: 'Summarize this email: {{ $json.body }}',
          description: 'What you want Carina to do. Supports n8n expressions to reference previous node data.',
        },
        {
          displayName: 'System Prompt',
          name: 'systemPrompt',
          type: 'string',
          typeOptions: { rows: 3 },
          default: '',
          description: 'Optional context for Carina. E.g. "You are analyzing property investment leads."',
        },
        {
          displayName: 'Session ID',
          name: 'sessionId',
          type: 'string',
          default: '',
          description: 'Optional session key for conversation continuity across workflow runs. Leave blank for a
  fresh session each time.',
        },
        {
          displayName: 'Options',
          name: 'options',
          type: 'collection',
          placeholder: 'Add option',
          default: {},
          options: [
            {
              displayName: 'Model Override',
              name: 'model',
              type: 'string',
              default: '',
              placeholder: 'deepseek-chat',
              description: 'Override the LLM model. Leave blank to use Carina default.',
            },
            {
              displayName: 'Domain Pack',
              name: 'pack',
              type: 'string',
              default: '',
              placeholder: 'property-uk',
              description: 'Skill pack to activate for this request.',
            },
          ],
        },
      ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
      const items = this.getInputData();
      const results: INodeExecutionData[] = [];

      const credentials = await this.getCredentials('carinaApi');
      const baseUrl = String(credentials.baseUrl ?? 'http://localhost:3333').replace(/\/$/, '');
      const apiKey = String(credentials.apiKey ?? '');
      const timeoutMs = Number(credentials.timeout ?? 120) * 1000;

      for (let i = 0; i < items.length; i++) {
        const prompt = this.getNodeParameter('prompt', i, '') as string;
        const systemPrompt = this.getNodeParameter('systemPrompt', i, '') as string;
        const sessionId = this.getNodeParameter('sessionId', i, '') as string;
        const options = this.getNodeParameter('options', i, {}) as IDataObject;

        if (!prompt.trim()) {
          throw new NodeOperationError(this.getNode(), 'Prompt is required', { itemIndex: i });
        }

        const body: IDataObject = { prompt: prompt.trim() };
        if (sessionId) body.sessionId = sessionId;
        if (systemPrompt) body.systemPrompt = systemPrompt;
        if (options.model) body.model = options.model;
        if (options.pack) body.pack = options.pack;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetch(`${baseUrl}/acp/prompt`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } catch (err: unknown) {
          clearTimeout(timer);
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('abort') || msg.includes('timeout')) {
            throw new NodeOperationError(
              this.getNode(),
              `Carina did not respond within ${Number(credentials.timeout ?? 120)} seconds.`,
              { itemIndex: i },
            );
          }
          throw new NodeOperationError(
            this.getNode(),
            `Cannot reach Carina at ${baseUrl}. Is it running? Error: ${msg}`,
            { itemIndex: i },
          );
        } finally {
          clearTimeout(timer);
        }

        if (!response.ok) {
          let errorDetail = '';
          try {
            const errBody = await response.json() as IDataObject;
            errorDetail = String(errBody.error ?? errBody.message ?? '');
          } catch {
            errorDetail = await response.text().catch(() => '');
          }
          throw new NodeOperationError(
            this.getNode(),
            `Carina returned ${response.status}${errorDetail ? ': ' + errorDetail : ''}.`,
            { itemIndex: i },
          );
        }

        const contentType = response.headers.get('content-type') ?? '';

        let responseText: string;
        let returnedSessionId: string | undefined;

        if (contentType.includes('text/event-stream')) {
          // Collect SSE stream into full text
          const reader = response.body?.getReader();
          if (!reader) throw new NodeOperationError(this.getNode(), 'Empty response stream', { itemIndex: i });
          const decoder = new TextDecoder();
          const chunks: string[] = [];
          let done = false;
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              const text = decoder.decode(value, { stream: !done });
              for (const line of text.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const parsed = JSON.parse(line.slice(6)) as IDataObject;
                  if (parsed.type === 'text' && parsed.content) chunks.push(String(parsed.content));
                  if (parsed.sessionId) returnedSessionId = String(parsed.sessionId);
                } catch { /* skip malformed lines */ }
              }
            }
          }
          responseText = chunks.join('');
        } else {
          const json = await response.json() as IDataObject;
          responseText = String(json.response ?? json.content ?? json.text ?? '');
          returnedSessionId = json.sessionId ? String(json.sessionId) : undefined;
        }

        results.push({
          json: {
            response: responseText,
            sessionId: returnedSessionId ?? sessionId,
            prompt: prompt.trim(),
            baseUrl,
          },
        });
      }

      return [results];
    }
  }

  FILE: integrations/n8n-carina-node/nodes/Carina/carina.svg
  Use a simple inline SVG - a plain grey circle with "C" as placeholder:
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="30" fill="#1e293b"/>
    <text x="32" y="42" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#38bdf8">C</text>
  </svg>

  FILE: integrations/n8n-carina-node/nodes/Carina/Carina.node.json
  {
    "node": "n8n-nodes-carina.carina",
    "nodeVersion": "1.0",
    "codexVersion": "1.0",
    "categories": ["AI"],
    "resources": {
      "credentialDocumentation": [
        { "url": "https://docs.carinaai.uk/developer/api" }
      ],
      "primaryDocumentation": [
        { "url": "https://docs.carinaai.uk/integrations/n8n" }
      ]
    }
  }

  ---

  PART 5: Tests

  FILE TO CREATE: src/tools/n8n.test.ts

  import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
  import { n8nTool } from './n8n.js';

  const exec = (params: Record<string, unknown>) => n8nTool.execute(params);

  const mockFetch = (status: number, body: unknown, ok?: boolean) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: ok ?? status < 400,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }));
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.N8N_BASE_URL = 'https://n8n.example.com';
    process.env.N8N_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.N8N_BASE_URL;
    delete process.env.N8N_API_KEY;
  });

  describe('n8n tool - trigger', () => {
    it('triggers a workflow by ID via /run endpoint', async () => {
      mockFetch(200, { executionId: 'abc123', status: 'running' });
      const result = await exec({ action: 'trigger', workflow_id: '42' });
      expect(result).toMatchObject({ triggered: true, execution_id: 'abc123', status: 'running' });
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain('/api/v1/workflows/42/run');
      expect(call[1].headers['X-N8N-API-KEY']).toBe('test-api-key');
    });

    it('triggers a webhook path directly', async () => {
      mockFetch(200, { executionId: 'wh999' });
      await exec({ action: 'trigger', workflow_id: 'my-webhook/path' });
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain('/webhook/my-webhook/path');
    });

    it('returns error when N8N_BASE_URL not set', async () => {
      delete process.env.N8N_BASE_URL;
      const result = await exec({ action: 'trigger', workflow_id: '1' });
      expect(result).toMatchObject({ error: expect.stringContaining('N8N_BASE_URL') });
    });

    it('returns error when workflow_id not provided', async () => {
      const result = await exec({ action: 'trigger' });
      expect(result).toMatchObject({ error: expect.stringContaining('workflow_id') });
    });

    it('returns error on 404', async () => {
      mockFetch(404, { message: 'not found' }, false);
      const result = await exec({ action: 'trigger', workflow_id: '99' });
      expect(result).toMatchObject({ error: expect.stringContaining('not found') });
    });

    it('accepts inline base_url and api_key overrides', async () => {
      mockFetch(200, { executionId: 'x1' });
      await exec({ action: 'trigger', workflow_id: '1', base_url: 'https://other.n8n.io', api_key: 'override-key'
  });
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain('other.n8n.io');
      expect(call[1].headers['X-N8N-API-KEY']).toBe('override-key');
    });
  });

  describe('n8n tool - status', () => {
    it('returns execution status', async () => {
      mockFetch(200, { id: 'abc123', status: 'success', finished: true, startedAt: '2025-01-01T00:00:00Z',
  stoppedAt: '2025-01-01T00:00:05Z' });
      const result = await exec({ action: 'status', execution_id: 'abc123' }) as Record<string, unknown>;
      expect(result.status).toBe('success');
      expect(result.finished).toBe(true);
      expect(typeof result.duration_ms).toBe('number');
    });

    it('returns error when execution_id not provided', async () => {
      const result = await exec({ action: 'status' });
      expect(result).toMatchObject({ error: expect.stringContaining('execution_id') });
    });

    it('returns error on 404', async () => {
      mockFetch(404, {}, false);
      const result = await exec({ action: 'status', execution_id: 'missing' });
      expect(result).toMatchObject({ error: expect.stringContaining('missing') });
    });
  });

  describe('n8n tool - list', () => {
    it('returns workflow list', async () => {
      mockFetch(200, { data: [{ id: '1', name: 'Portfolio Report', active: true, updatedAt: '2025-01-01' }] });
      const result = await exec({ action: 'list' }) as Record<string, unknown>;
      expect(Array.isArray(result.workflows)).toBe(true);
      expect((result.workflows as unknown[])[0]).toMatchObject({ id: '1', name: 'Portfolio Report', active: true
  });
    });

    it('returns error when N8N_BASE_URL not set', async () => {
      delete process.env.N8N_BASE_URL;
      const result = await exec({ action: 'list' });
      expect(result).toMatchObject({ error: expect.stringContaining('N8N_BASE_URL') });
    });
  });

  describe('n8n tool - meta', () => {
    it('needsConfirmation returns true for trigger, false for others', () => {
      expect(n8nTool.needsConfirmation?.({ action: 'trigger' })).toBe(true);

  describe('n8n tool - meta', () => {
    it('needsConfirmation returns true for trigger, false for others', () => {
      expect(n8nTool.needsConfirmation?.({ action: 'trigger' })).toBe(true);
      expect(n8nTool.needsConfirmation?.({ action: 'status' })).toBe(false);
      expect(n8nTool.needsConfirmation?.({ action: 'list' })).toBe(false);
    });
  });

  ---

  PART 6: Documentation

  FILE TO CREATE: docs/integrations/n8n.md

  Write a documentation page covering:
    1. What n8n is and why to integrate with Carina (one short paragraph each)
    2. Carina calling n8n - the n8n tool:
       - install: ensure N8N_BASE_URL and N8N_API_KEY are set in .env
         (n8n: Settings > API > Enable Public API to get the key)
       - example: "carina, list my n8n workflows"
       - example: "carina, trigger the portfolio-report workflow"
       - example: "carina, check the status of execution abc123"
    3. n8n calling Carina - the community node:
       - install: "npm install n8n-nodes-carina" in the n8n custom nodes directory
         or via n8n Settings > Community Nodes > Install
       - configure the credential: base URL + API key (CARINA_OPS_TOKEN)
       - sample workflow table with columns: Trigger, Carina prompt, Output:
         | Email received (Gmail) | "Summarize this email and flag if urgent: {{ $json.body }}" | Slack notification |
         | Daily cron (8am) | "Generate a portfolio summary for today" | Google Sheets append |
         | Typeform submission | "Qualify this property lead: {{ $json.answers }}" | CRM update |
    4. Environment variables reference table:
       | Variable | Where used | Required | Description |
       | N8N_BASE_URL | Carina n8n tool | When using trigger/list | Your n8n instance URL |
       | N8N_API_KEY  | Carina n8n tool | When using trigger/list | n8n API key |
    5. Troubleshooting:
       - "n8n says API not enabled": enable Settings > API in n8n and set ENABLE_PUBLIC_API=true
       - "Carina unreachable from n8n": check baseUrl in the credential; use the machine IP not localhost if n8n is in Docker
       - "Execution timeout": increase Timeout in the Carina credential (default 120s)

  FILE TO EDIT: docs/capabilities.md

  Find the integrations list section. Add:
    - n8n: visual workflow automation (trigger n8n workflows from Carina; use Carina as a node in n8n)

  If docs/capabilities.md does not have a clear integrations section, add this line
  in a suitable place near other third-party integrations (Spotify, Home Assistant, Discord, etc.).

  ---

  ACCEPTANCE CHECKLIST (verify before finishing):

  1. pnpm test passes with the new n8n.test.ts file. All test cases green.
  2. TypeScript compiles: pnpm build produces no errors.
  3. n8n tool appears in registry: calling registry.list() includes { name: 'n8n' }.
  4. integrations/n8n-carina-node/package.json has "n8n-community-node-package" in keywords.
  5. integrations/n8n-carina-node/tsconfig.json compiles cleanly: cd integrations/n8n-carina-node && npx tsc --noEmit
  6. No circular imports: n8n.ts imports only from src/config/index.js and src/types/index.js.
  7. No em-dashes. No emojis. Plain ASCII throughout.

