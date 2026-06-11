import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import {
  PROVIDER_DEFINITIONS,
  isProviderConfigured,
  PROVIDER_MAP,
} from '../../brain/provider-registry.js';
import {
  describeOAuthSessions,
  getCredentialPoolManager,
  getValidOAuthAccessToken,
  OAUTH_PROVIDERS,
  revokeOAuthToken,
  runDeviceFlowInteractive,
} from '../../credentials/index.js';
import { appendEnvValue } from '../config/loader.js';
import { loadLocalEnv } from '../config/env.js';
import { bindOperatorProfile } from '../../ops/operator-profile.js';

function redact(value: string): string {
  if (!value) return '(empty)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function poolEnvKeys(provider: string): string[] {
  const def = PROVIDER_MAP[provider];
  if (!def) return [];
  const raw = process.env[def.apiKeysPoolEnv] ?? '';
  return raw.split(',').map((k) => k.trim()).filter(Boolean);
}

async function syncPoolToEnv(provider: string): Promise<void> {
  const def = PROVIDER_MAP[provider];
  if (!def) return;
  const mgr = getCredentialPoolManager();
  const keys = mgr.resolveKeys(provider, process.env[def.apiKeyEnv] ?? '', process.env[def.apiKeysPoolEnv]);
  if (keys.length > 1) {
    await appendEnvValue(def.apiKeysPoolEnv, keys.join(','));
  }
}

function parseProfileFlag(args: string[]): { profile?: string; rest: string[] } {
  const rest: string[] = [];
  let profile: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[++i];
    } else {
      rest.push(args[i]!);
    }
  }
  return { profile, rest };
}

export async function runCredentialsCommand(args: string[]): Promise<void> {
  const { profile, rest } = parseProfileFlag(args);
  const opCtx = bindOperatorProfile(profile);
  loadLocalEnv();
  const action = rest[0] ?? 'status';
  const sub = rest[1];
  const mgr = getCredentialPoolManager();

  if (action === 'status' || action === 'list') {
    console.log(chalk.bold(`\nCredential pools (profile: ${opCtx.profileName})\n`));
    console.log(chalk.gray(`  store: ${opCtx.credentialsPath}\n`));
    for (const def of PROVIDER_DEFINITIONS) {
      const pool = mgr.describePool(def.name);
      if (pool.size === 0 && !isProviderConfigured(def)) continue;
      const marker = isProviderConfigured(def) ? chalk.green('ok') : chalk.gray('missing');
      console.log(`  ${def.name.padEnd(14)} ${marker}  keys=${pool.size}  next=${pool.index}`);
      for (const key of pool.keys) {
        const cool = key.coolingDown ? chalk.yellow(' cooldown') : '';
        console.log(chalk.gray(`    ${key.redacted}${cool}${key.failures ? ` fails=${key.failures}` : ''}`));
      }
    }

    console.log(chalk.bold('\nOAuth sessions\n'));
    for (const row of describeOAuthSessions()) {
      const status = row.loggedIn
        ? chalk.green('logged in')
        : row.configured
          ? chalk.gray('ready')
          : chalk.yellow('needs client id');
      console.log(`  ${row.name.padEnd(10)} ${status}  ${row.displayName}`);
      if (row.loggedIn && row.expiresAt) {
        console.log(chalk.gray(`             expires ${new Date(row.expiresAt).toISOString()}`));
      }
    }
    console.log('');
    return;
  }

  if (action === 'pools') {
    const provider = sub;
    if (!provider) {
      console.error('Usage: carina credentials pools <provider>');
      process.exit(1);
    }
    const pool = mgr.describePool(provider);
    console.log(JSON.stringify(pool, null, 2));
    return;
  }

  if (action === 'remove' || action === 'retire') {
    const provider = sub;
    const keyMatch = rest[2];
    if (!provider || !keyMatch) {
      console.error(`Usage: carina credentials ${action} <provider> <key-prefix-or-index>`);
      process.exit(1);
    }
    const ok = action === 'retire'
      ? mgr.retireKey(provider, keyMatch)
      : mgr.removeKey(provider, keyMatch);
    if (!ok) {
      console.error(`No matching key in ${provider} pool`);
      process.exit(1);
    }
    console.log(chalk.green(`Removed key from ${provider} pool`));
    await syncPoolToEnv(provider);
    return;
  }

  if (action === 'add') {
    const provider = sub;
    const key = rest[2];
    if (!provider || !key) {
      console.error('Usage: carina credentials add <provider> <api-key>');
      process.exit(1);
    }
    const def = PROVIDER_MAP[provider];
    if (!def) {
      console.error(`Unknown provider: ${provider}`);
      process.exit(1);
    }
    mgr.addKey(provider, key);
    const merged = mgr.resolveKeys(provider, process.env[def.apiKeyEnv] ?? '', process.env[def.apiKeysPoolEnv]);
    await appendEnvValue(def.apiKeysPoolEnv, merged.join(','));
    console.log(chalk.green(`Added key to ${provider} pool (${merged.length} keys). Env: ${def.apiKeysPoolEnv}`));
    return;
  }

  if (action === 'rotate') {
    const provider = sub;
    if (!provider) {
      console.error('Usage: carina credentials rotate <provider>');
      process.exit(1);
    }
    const next = mgr.rotate(provider);
    if (!next) {
      console.error(`No keys in pool for ${provider}`);
      process.exit(1);
    }
    console.log(chalk.green(`Rotated ${provider} pool. Next key: ${redact(next)}`));
    return;
  }

  if (action === 'test') {
    const provider = sub;
    if (!provider) {
      console.error('Usage: carina credentials test <provider>');
      process.exit(1);
    }
    const { runModelCommand } = await import('./model.js');
    await runModelCommand(['test', provider]);
    return;
  }

  if (action === 'oauth') {
    const oauthAction = sub ?? 'list';

    if (oauthAction === 'list') {
      console.log(chalk.bold('\nOAuth providers (device flow)\n'));
      for (const def of OAUTH_PROVIDERS) {
        const row = describeOAuthSessions().find((r) => r.name === def.name);
        const status = row?.loggedIn
          ? chalk.green('logged in')
          : process.env[def.clientIdEnv]
            ? chalk.gray('ready')
            : chalk.yellow(`set ${def.clientIdEnv}`);
        console.log(`  ${def.name.padEnd(10)} ${status}  ${def.displayName}`);
        console.log(chalk.gray(`             scope: ${def.scope}`));
      }
      console.log('\nLogin: carina credentials oauth login <provider>\n');
      return;
    }

    if (oauthAction === 'status') {
      for (const row of describeOAuthSessions()) {
        const token = getValidOAuthAccessToken(row.name);
        console.log(`${row.name}: ${token ? `active (${redact(token)})` : row.loggedIn ? 'expired' : 'not logged in'}`);
      }
      return;
    }

    if (oauthAction === 'login') {
      const provider = rest[2];
      if (!provider) {
        const choice = await select({
          message: 'OAuth provider',
          choices: OAUTH_PROVIDERS.map((p) => ({
            name: `${p.displayName} (${p.name})`,
            value: p.name,
          })),
        });
        await loginOAuth(choice);
        return;
      }
      await loginOAuth(provider);
      return;
    }

    if (oauthAction === 'revoke') {
      const provider = rest[2];
      if (!provider) {
        console.error('Usage: carina credentials oauth revoke <provider>');
        process.exit(1);
      }
      revokeOAuthToken(provider);
      console.log(chalk.green(`Revoked OAuth token for ${provider}`));
      return;
    }

    console.error('Usage: carina credentials oauth <list|login|status|revoke> [provider]');
    process.exit(1);
  }

  console.error('Usage: carina credentials <status|pools|add|remove|retire|rotate|test|oauth> [--profile NAME] ...');
  process.exit(1);
}

async function loginOAuth(provider: string): Promise<void> {
  const token = await runDeviceFlowInteractive(provider, {
    onPrompt: (info) => {
      console.log(chalk.bold(`\n${info.provider} device authorization\n`));
      console.log(`Open: ${info.verificationUri}`);
      if (info.verificationUriComplete) {
        console.log(`Or:   ${info.verificationUriComplete}`);
      }
      console.log(`Code: ${chalk.cyan(info.userCode)}`);
      console.log(chalk.gray('Waiting for authorization...\n'));
    },
  });
  const def = PROVIDER_MAP[provider];
  if (def && provider === 'openai') {
    await appendEnvValue(def.apiKeyEnv, token);
    console.log(chalk.green(`Saved OAuth token to ${def.apiKeyEnv}`));
  } else if (def && provider === 'azure') {
    await appendEnvValue(def.apiKeyEnv, token);
    console.log(chalk.green(`Saved Azure OAuth token to ${def.apiKeyEnv}`));
  } else {
    console.log(chalk.green(`OAuth login complete for ${provider} (${redact(token)})`));
  }
  await syncPoolToEnv(provider);
}
