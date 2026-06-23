import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tmpHome } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require('node:path') as typeof import('path');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeOs = require('node:os') as typeof import('os');
  return { tmpHome: nodePath.join(nodeOs.tmpdir(), `carina-pack-cli-${process.pid}`) };
});

vi.mock('../../../config/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/paths.js')>();
  return {
    ...actual,
    CARINA_HOME: tmpHome,
    resolveCarinaHome: () => tmpHome,
    CARINA_PACKS_DIR: path.join(tmpHome, 'packs'),
    CARINA_ENV_PATH: path.join(tmpHome, '.env'),
    packDir: (name: string) => path.join(tmpHome, 'packs', name),
  };
});

vi.mock('../../../skills/eval/gate.js', () => ({
  runPackEvalGate: vi.fn(async () => ({ blocked: false, message: '' })),
  resolveGateMode: vi.fn(() => 'off'),
}));

vi.mock('../../../skills/hub/hub-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../skills/hub/hub-client.js')>();
  return {
    ...actual,
    isPremiumPaidPack: vi.fn(() => false),
    resolvePremiumPackLicense: vi.fn(async () => undefined),
  };
});

vi.mock('../../../skills/ingestion.js', () => ({
  ingestPackDirectory: vi.fn(async () => 0),
}));

vi.mock('../../../skills/index.js', () => ({
  loadPackSkills: vi.fn(async () => 2),
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    exec: (
      cmd: string,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      if (cmd.includes('tar -xzf')) {
        const dest = cmd.match(/-C "([^"]+)"/)?.[1];
        if (dest) {
          import('node:fs/promises').then((fs) =>
            fs.mkdir(dest, { recursive: true })
              .then(() => fs.writeFile(path.join(dest, 'pack.json'), JSON.stringify({
                name: 'property-uk',
                version: '1.0.0',
                description: 'UK property',
                author: 'VERLOX Ltd',
                skillCount: 6,
              })))
              .then(() => fs.writeFile(path.join(dest, 'readme.md'), '# pack'))
              .then(() => cb(null, '', ''))
              .catch((err) => cb(err as Error, '', '')),
          );
          return undefined;
        }
      }
      if (cmd.startsWith('cp -r')) {
        cb(null, '', '');
        return undefined;
      }
      return actual.exec(cmd, cb);
    },
  };
});

describe('carina pack CLI', () => {
  beforeEach(async () => {
    vi.resetModules();
    await fs.rm(tmpHome, { recursive: true, force: true });
    await fs.mkdir(path.join(tmpHome, 'packs'), { recursive: true });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it('search returns filtered results', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      expect(String(url)).toContain('/api/packs?q=property');
      return new Response(JSON.stringify({
        packs: [{
          name: 'property-uk',
          version: '1.0.0',
          description: 'UK property compliance and data tools',
          author: 'VERLOX Ltd',
          category: 'property',
          skill_count: 6,
          download_count: 0,
          featured: true,
          created_at: '',
          updated_at: '',
        }],
      }), { status: 200 });
    }));

    const { runPackSearch } = await import('./search.js');
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((line) => {
      logs.push(String(line));
    });

    await runPackSearch(['property']);
    expect(logs.join('\n')).toContain('property-uk');
    expect(logs.join('\n')).toContain('1.0.0');
    spy.mockRestore();
  });

  it('install writes config and pack directory', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/packs/property-uk')) {
        return new Response(JSON.stringify({
          name: 'property-uk',
          version: '1.0.0',
          description: 'UK property',
          author: 'VERLOX Ltd',
          category: 'property',
          skill_count: 6,
          download_count: 0,
          featured: true,
          pricing_tier: 'free',
          price_gbp_cents: null,
          author_revenue_share_bps: 7000,
          carina_revenue_share_bps: 2000,
          platform_fee_bps: 1000,
          stripe_price_id: null,
          created_at: '',
          updated_at: '',
        }), { status: 200 });
      }
      if (String(url).includes('/download')) {
        return new Response(Buffer.from('fake'), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }));

    const { installPackSlug } = await import('./install.js');
    await installPackSlug('property-uk', { bypassEval: true, baseUrl: 'http://hub.test' });

    const env = await fs.readFile(path.join(tmpHome, '.env'), 'utf8');
    expect(env).toContain('ACTIVE_SKILL_PACKS=property-uk');
    const manifest = await fs.readFile(path.join(tmpHome, 'packs', 'property-uk', 'pack.json'), 'utf8');
    expect(manifest).toContain('property-uk');
  });

  it('publish rejects invalid pack missing manifest', async () => {
    const badDir = path.join(tmpHome, 'bad-pack');
    await fs.mkdir(badDir, { recursive: true });
    await fs.writeFile(path.join(badDir, 'notes.md'), '# notes only');

    const { runPackPublish } = await import('./publish.js');
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((line) => {
      errors.push(String(line));
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? 0}`);
    }) as never);

    await expect(runPackPublish([badDir])).rejects.toThrow('exit:1');
    expect(errors.join('\n')).toMatch(/pack\.json|ENOENT|must include/i);
    spy.mockRestore();
    exit.mockRestore();
  });

  it('install rejects premium pack without license', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/packs/premium-demo')) {
        return new Response(JSON.stringify({
          name: 'premium-demo',
          version: '1.0.0',
          description: 'Premium',
          author: 'Author',
          category: 'demo',
          skill_count: 1,
          download_count: 0,
          featured: false,
          pricing_tier: 'premium',
          price_gbp_cents: 1999,
          author_revenue_share_bps: 7000,
          carina_revenue_share_bps: 2000,
          platform_fee_bps: 1000,
          stripe_price_id: null,
          created_at: '',
          updated_at: '',
        }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }));

    const hubClient = await import('../../../skills/hub/hub-client.js');
    vi.mocked(hubClient.isPremiumPaidPack).mockReturnValue(true);
    vi.mocked(hubClient.resolvePremiumPackLicense).mockResolvedValue(undefined);

    const { installPackSlug } = await import('./install.js');
    await expect(installPackSlug('premium-demo', { bypassEval: true, baseUrl: 'http://hub.test' }))
      .rejects
      .toThrow(/requires a Hub license/i);
  });

  it('publish rejects pack containing .env files', async () => {
    const packDir = path.join(tmpHome, 'secret-pack');
    await fs.mkdir(packDir, { recursive: true });
    await fs.writeFile(path.join(packDir, 'pack.json'), JSON.stringify({
      name: 'secret-pack',
      version: '0.1.0',
      description: 'bad pack',
      author: 'test',
      skillCount: 1,
    }));
    await fs.writeFile(path.join(packDir, 'guide.md'), '# guide');
    await fs.writeFile(path.join(packDir, '.env'), 'API_KEY=secret');

    const { publishPackToHub } = await import('../../../skills/hub/hub-client.js');
    await expect(publishPackToHub(packDir, { baseUrl: 'http://localhost:3001' }))
      .rejects
      .toThrow(/environment files/i);
  });
});

describe('pack shared helpers', () => {
  it('detects semver upgrades', async () => {
    const { isSemverNewer } = await import('./shared.js');
    expect(isSemverNewer('1.2.0', '1.1.9')).toBe(true);
    expect(isSemverNewer('1.1.0', '1.2.0')).toBe(false);
  });
});
