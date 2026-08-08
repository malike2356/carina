import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

describe('agent-engine OPS page (C05)', () => {
  it('registers router and view assets', () => {
    const server = readFileSync(path.join(root, 'server.ts'), 'utf8');
    expect(server).toContain("from './routes/agent-engine.js'");
    expect(server).toContain("app.use('/agent-engine', agentEngineRouter)");

    const layout = readFileSync(path.join(root, 'views/layout.ejs'), 'utf8');
    expect(layout).toContain('/agent-engine');
    expect(layout).toContain('Agent engine');

    const view = readFileSync(path.join(root, 'views/agent-engine.ejs'), 'utf8');
    expect(view).toContain('Emergency rollback');
    expect(view).toContain('Restart engine');
    expect(view).toContain('Workspace assignment');

    const route = readFileSync(path.join(root, 'routes/agent-engine.ts'), 'utf8');
    expect(route).toContain('/api/ops/agent-engine/health');
    expect(route).toContain('writeOpsAudit');
    expect(route).toContain('emergency-rollback');
  });
});
