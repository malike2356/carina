import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  buildUserProfileMarkdown,
  isDefaultUserProfile,
  seedWorkspaceFromProfile,
} from './workspace-seed.js';
import {
  collectContainerEnvLines,
  runContainerBootstrap,
} from './container-bootstrap.js';

describe('workspace-seed', () => {
  it('builds USER.md from operator profile fields', () => {
    const md = buildUserProfileMarkdown('Sam', 'Property sourcing tool');
    expect(md).toContain('**Name:** Sam');
    expect(md).toContain('**Focus:** Property sourcing tool');
  });

  it('detects default USER.md placeholder', () => {
    expect(isDefaultUserProfile('Operator name, background, preferences')).toBe(true);
    expect(isDefaultUserProfile('- **Name:** Alex\nCustom notes')).toBe(false);
  });
});

describe('workspace-seed persistence', () => {
  let tmpHome: string;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-seed-'));
    process.env.CARINA_HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    delete process.env.CARINA_OPERATOR_NAME;
    delete process.env.CARINA_OPERATOR_CONTEXT;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('seeds USER.md after onboarding profile answers', async () => {
    process.env.CARINA_OPERATOR_NAME = 'Riley';
    process.env.CARINA_OPERATOR_CONTEXT = 'Agent marketplace';

    await seedWorkspaceFromProfile(tmpHome);

    const userPath = path.join(tmpHome, 'workspaces', 'main', 'USER.md');
    const userMd = await fs.readFile(userPath, 'utf-8');
    expect(userMd).toContain('**Name:** Riley');
    expect(userMd).toContain('**Focus:** Agent marketplace');
    await expect(fs.access(path.join(tmpHome, 'workspaces', 'main', 'AGENTS.md'))).resolves.toBeUndefined();
  });
});

describe('container-bootstrap', () => {
  let tmpData: string;
  const prevHome = process.env.CARINA_HOME;

  beforeEach(async () => {
    tmpData = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-docker-'));
    process.env.CARINA_HOME = path.join(tmpData, '.carina');
    vi.resetModules();
  });

  afterEach(async () => {
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.CARINA_OPERATOR_NAME;
    await fs.rm(tmpData, { recursive: true, force: true });
  });

  it('collects runtime env into bootstrap lines', () => {
    const lines = collectContainerEnvLines({
      DEEPSEEK_API_KEY: 'sk-test',
      CARINA_OPERATOR_NAME: 'Alex',
      DEFAULT_PROVIDER: 'deepseek',
    });
    expect(lines.join('\n')).toContain('DEEPSEEK_API_KEY=sk-test');
    expect(lines.join('\n')).toContain('CARINA_ONBOARDING_DONE=true');
  });

  it('creates CARINA_HOME, env, and workspace seeds on first boot', async () => {
    process.env.DEEPSEEK_API_KEY = 'sk-docker';
    process.env.CARINA_OPERATOR_NAME = 'Container User';
    process.env.DEFAULT_PROVIDER = 'deepseek';

    await runContainerBootstrap(process.env.CARINA_HOME);

    const env = await fs.readFile(path.join(process.env.CARINA_HOME!, '.env'), 'utf-8');
    expect(env).toContain('DEEPSEEK_API_KEY=sk-docker');
    expect(env).toContain('CARINA_OPERATOR_NAME=Container User');

    const userPath = path.join(process.env.CARINA_HOME!, 'workspaces', 'main', 'USER.md');
    const userMd = await fs.readFile(userPath, 'utf-8');
    expect(userMd).toContain('**Name:** Container User');
  });
});

describe('docker compose artifacts', () => {
  it('includes standalone and GPU compose files', async () => {
    const root = path.resolve(import.meta.dirname, '../..');
    await expect(fs.access(path.join(root, 'docker-compose.standalone.yml'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(root, 'docker-compose.gpu-nvidia.yml'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(root, 'docker/docker-entrypoint.sh'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(root, 'install.sh'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(root, 'installer/install-windows.ps1'))).resolves.toBeUndefined();
  });
});
