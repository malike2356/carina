import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadCarinaEnv } from '../config/load-env.js';
import { resolveCarinaHome } from '../config/paths.js';
import { writeMinimalBootstrap } from '../cli/first-run.js';
import { readEnvFileContents } from '../cli/provider-bootstrap.js';
import { ensureAgentsConfig } from '../workspaces/agent-registry.js';
import { seedWorkspaceFromProfile } from './workspace-seed.js';

/** Env keys copied from Docker/Kubernetes into ~/.carina/.env on first boot. */
export const CONTAINER_ENV_KEYS = [
  'DEFAULT_PROVIDER',
  'DEFAULT_MODEL',
  'DEEPSEEK_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'CARINA_OPERATOR_NAME',
  'CARINA_OPERATOR_CONTEXT',
  'CARINA_ONBOARDING_DONE',
  'CARINA_LOCAL_MODE',
  'CARINA_SKIP_POSTGRES',
  'CARINA_MEMORY_BACKEND',
  'DATABASE_URL',
  'REDIS_URL',
  'WEB_ENABLED',
  'WEB_PORT',
  'JWT_SECRET',
  'OLLAMA_ENABLED',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'CARINA_LANGUAGE',
  'CARINA_LOCALE',
] as const;

export function collectContainerEnvLines(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const lines: string[] = [
    '# Carina container bootstrap (generated on first start)',
  ];

  for (const key of CONTAINER_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) {
      lines.push(`${key}=${value}`);
    }
  }

  if (lines.length <= 1) {
    return [];
  }

  if (!env.CARINA_ONBOARDING_DONE?.trim()) {
    lines.push('CARINA_ONBOARDING_DONE=true');
  }

  return lines;
}

/**
 * Non-interactive first-run for Docker/Kubernetes.
 * Ensures CARINA_HOME, .env, agent workspace seeds, and USER.md profile exist.
 */
export async function runContainerBootstrap(homeDir?: string): Promise<void> {
  const home = homeDir ?? process.env.CARINA_HOME ?? '/data/.carina';
  process.env.CARINA_HOME = home;

  await fs.mkdir(home, { recursive: true });

  const envPath = path.join(home, '.env');
  const existing = await readEnvFileContents(envPath);

  if (!existing.trim()) {
    const fromRuntime = collectContainerEnvLines();
    if (fromRuntime.length > 0) {
      await fs.writeFile(envPath, `${fromRuntime.join('\n')}\n`, { mode: 0o600 });
    } else {
      await writeMinimalBootstrap();
    }
  }

  loadCarinaEnv();
  await seedWorkspaceFromProfile(resolveCarinaHome());
  await ensureAgentsConfig(resolveCarinaHome());

  console.log(`[carina] Container bootstrap ready (CARINA_HOME=${resolveCarinaHome()})`);
}

async function main(): Promise<void> {
  await runContainerBootstrap();
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error('[carina] Container bootstrap failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
