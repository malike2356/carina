import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import session from 'express-session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockHttpClient {
  constructor(
    public readonly name: string,
    private readonly baseUrl: string,
  ) {}

  async connect() {
    return [{ name: `http:${this.name}`, description: this.baseUrl }];
  }

  async disconnect() {}
}

class MockStdioClient {
  constructor(
    public readonly name: string,
    private readonly command: string,
    private readonly args: string[] = [],
    private readonly env: Record<string, string> = {},
  ) {}

  async connect() {
    return [{ name: `stdio:${this.name}`, description: `${this.command} ${this.args.join(' ')}`.trim() }];
  }

  async disconnect() {}
}

vi.mock('../mcp/http-client.js', () => ({ McpHttpClient: MockHttpClient }));
vi.mock('../mcp/stdio-client.js', () => ({ McpStdioClient: MockStdioClient }));

const { mcpApiRouter } = await import('./mcp-api.js');

function createTempHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-mcp-api-'));
  process.env.CARINA_HOME = dir;
  process.env.CARINA_INTERNAL_KEY = 'test-internal';
  return dir;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use('/api/mcp', mcpApiRouter);
  return app;
}

async function request(
  app: ReturnType<typeof makeApp>,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  pathName: string,
  body?: unknown,
) {
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${pathName}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': 'test-internal',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) as Record<string, unknown> : {};
    return { res, json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('mcp-api', () => {
  let homeDir = '';

  beforeEach(() => {
    homeDir = createTempHome();
  });

  afterEach(() => {
    fs.rmSync(homeDir, { recursive: true, force: true });
    delete process.env.CARINA_HOME;
    delete process.env.CARINA_INTERNAL_KEY;
  });

  it('lists configured servers, adds, updates, tests, and removes them', async () => {
    const app = makeApp();

    let response = await request(app, 'GET', '/api/mcp');
    expect(response.res.status).toBe(200);
    expect(response.json.servers).toEqual([]);

    response = await request(app, 'POST', '/api/mcp', {
      name: 'demo',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { TOKEN: 'abc' },
    });
    expect(response.res.status).toBe(201);
    expect((response.json.server as { name: string }).name).toBe('demo');

    response = await request(app, 'PUT', '/api/mcp/demo', {
      name: 'demo-renamed',
      transport: 'http',
      url: 'https://example.test/mcp',
    });
    expect(response.res.status).toBe(200);
    expect((response.json.server as { name: string }).name).toBe('demo-renamed');

    response = await request(app, 'PATCH', '/api/mcp/demo-renamed', {
      enabled: false,
    });
    expect(response.res.status).toBe(200);
    expect((response.json.server as { enabled: boolean }).enabled).toBe(false);

    response = await request(app, 'POST', '/api/mcp/demo-renamed/test', {
      name: 'demo-renamed',
      transport: 'http',
      url: 'https://example.test/mcp',
    });
    expect(response.res.status).toBe(200);
    expect(Array.isArray(response.json.tools)).toBe(true);

    response = await request(app, 'DELETE', '/api/mcp/demo-renamed');
    expect(response.res.status).toBe(204);

    response = await request(app, 'GET', '/api/mcp');
    expect(response.res.status).toBe(200);
    expect(response.json.servers).toEqual([]);
  });
});
