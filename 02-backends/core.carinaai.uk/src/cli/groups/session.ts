import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { CARINA_HOME } from '../../config/paths.js';
import { initDb } from '../../memory/db.js';
import { browseRecentSessions, searchSessions } from '../../memory/session-index.js';
import { createSessionFile } from './workspace.js';
import { forceImmediateInvalidation } from '../../brain/prompt-cache.js';
import { resolveKnownWebGatewayUrl } from '../../infrastructure/web-gateway-port.js';
import type { CommandGroup, GroupContext } from '../group-command.js';

function parseLimit(args: string[], fallback = 20): number {
  const idx = args.indexOf('--limit');
  if (idx >= 0 && args[idx + 1]) return Math.max(1, Number.parseInt(args[idx + 1]!, 10) || fallback);
  return fallback;
}

async function listLocalSessions(limit: number): Promise<Array<Record<string, unknown>>> {
  const localDir = path.join(CARINA_HOME, 'sessions');
  const local: Array<Record<string, unknown>> = [];
  try {
    const files = await fs.readdir(localDir);
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      const raw = await fs.readFile(path.join(localDir, file), 'utf-8');
      local.push(JSON.parse(raw) as Record<string, unknown>);
    }
  } catch {
    // optional
  }
  return local.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))).slice(0, limit);
}

export const sessionGroup: CommandGroup = {
  name: 'session',
  aliases: ['s'],
  summary: 'Manage chat sessions',
  loadEnv: true,
  subcommands: [
    {
      name: 'list',
      aliases: ['ls'],
      description: 'List sessions (paginated)',
      options: ['--json', '--limit <n>  Default 20', '--since <date>  Filter by updated date'],
      examples: ['carina session list', 'carina s ls --json | jq ".local[0].id"'],
      handler: async (ctx: GroupContext) => {
        const limit = parseLimit(ctx.rawArgs);
        const sinceIdx = ctx.rawArgs.indexOf('--since');
        const since = sinceIdx >= 0 ? ctx.rawArgs[sinceIdx + 1] : undefined;
        const local = await listLocalSessions(limit);
        const filtered = since
          ? local.filter((s) => String(s.updatedAt ?? '') >= since)
          : local;

        let dbSessions: Awaited<ReturnType<typeof browseRecentSessions>> = [];
        try {
          await initDb();
          dbSessions = await browseRecentSessions(limit);
        } catch {
          // postgres optional
        }

        const payload = { local: filtered, db: dbSessions };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        console.log(chalk.bold('\nSessions\n'));
        for (const s of filtered) {
          console.log(`  ${String(s.id ?? '').slice(0, 8)}  local  ${String(s.source ?? '')}  ${String(s.updatedAt ?? '')}`);
        }
        for (const s of dbSessions) {
          console.log(`  ${s.sessionId.slice(0, 8)}  db     ${s.snippet.slice(0, 50)}`);
        }
        console.log('');
      },
    },
    {
      name: 'new',
      description: 'Create and enter a new session',
      handler: async (ctx: GroupContext) => {
        const created = await createSessionFile('cli');
        process.env.CARINA_SESSION_ID = created.id;
        if (ctx.json) {
          console.log(JSON.stringify(created, null, 2));
          return;
        }
        console.log(chalk.green(`New session ${created.id.slice(0, 8)}`));
        console.log(chalk.gray('Resume with: carina session resume ' + created.id.slice(0, 8)));
      },
    },
    {
      name: 'resume',
      aliases: ['r'],
      description: 'Resume a session by ID or prefix',
      usage: 'carina session resume <id-prefix>',
      handler: async (ctx: GroupContext) => {
        const query = ctx.positional[0];
        if (!query) {
          console.error('Usage: carina session resume <id>');
          process.exit(1);
        }
        const local = await listLocalSessions(200);
        const match = local.find((s) => String(s.id ?? '').startsWith(query));
        if (!match) {
          console.error(`Session not found: ${query}`);
          process.exit(1);
        }
        process.env.CARINA_SESSION_ID = String(match.id);
        if (ctx.json) {
          console.log(JSON.stringify({ resumed: match.id }, null, 2));
          return;
        }
        console.log(chalk.green(`Resumed session ${String(match.id).slice(0, 8)}`));
        console.log(chalk.gray('Open TUI: carina tui'));
      },
    },
    {
      name: 'rename',
      aliases: ['mv'],
      description: 'Rename a session label in local store',
      usage: 'carina session rename <id> <label>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        const label = ctx.positional.slice(1).join(' ');
        if (!id || !label) {
          console.error('Usage: carina session rename <id> <label>');
          process.exit(1);
        }
        const file = path.join(CARINA_HOME, 'sessions', `${id}.json`);
        try {
          const raw = await fs.readFile(file, 'utf-8');
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          parsed.label = label;
          parsed.updatedAt = new Date().toISOString();
          await fs.writeFile(file, JSON.stringify(parsed, null, 2), 'utf-8');
          if (ctx.json) {
            console.log(JSON.stringify(parsed, null, 2));
            return;
          }
          console.log(chalk.green(`Renamed session ${id.slice(0, 8)} to "${label}"`));
        } catch {
          console.error(`Session not found: ${id}`);
          process.exit(1);
        }
      },
    },
    {
      name: 'delete',
      aliases: ['rm'],
      description: 'Delete a session',
      usage: 'carina session delete <id>',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina session delete <id>');
          process.exit(1);
        }
        await fs.rm(path.join(CARINA_HOME, 'sessions', `${id}.json`), { force: true });
        if (ctx.json) {
          console.log(JSON.stringify({ deleted: id }, null, 2));
          return;
        }
        console.log(`Deleted session ${id}`);
      },
    },
    {
      name: 'export',
      description: 'Export session to JSON or markdown',
      usage: 'carina session export <id> [--format json|md]',
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina session export <id>');
          process.exit(1);
        }
        const formatIdx = ctx.rawArgs.indexOf('--format');
        const format = formatIdx >= 0 ? ctx.rawArgs[formatIdx + 1] : 'json';
        const file = path.join(CARINA_HOME, 'sessions', `${id}.json`);
        const raw = await fs.readFile(file, 'utf-8');
        const parsed = JSON.parse(raw) as { messages?: Array<{ role: string; content: string }> };
        if (format === 'md') {
          const lines = [`# Session ${id}`, ''];
          for (const m of parsed.messages ?? []) {
            lines.push(`## ${m.role}`, '', m.content, '');
          }
          console.log(lines.join('\n'));
          return;
        }
        console.log(JSON.stringify(parsed, null, 2));
      },
    },
    {
      name: 'share',
      description: 'Generate shareable link (if feature enabled)',
      usage: 'carina session share <id>',
      handler: async (ctx: GroupContext) => {
        const enabled = process.env.CARINA_SESSION_SHARE === 'true';
        if (!enabled) {
          const msg = { enabled: false, hint: 'Set CARINA_SESSION_SHARE=true to enable session sharing.' };
          if (ctx.json) {
            console.log(JSON.stringify(msg, null, 2));
            return;
          }
          console.log(chalk.yellow('Session sharing is not enabled.'));
          console.log(chalk.gray('Set CARINA_SESSION_SHARE=true in ~/.carina/.env'));
          return;
        }
        const id = ctx.positional[0];
        if (!id) {
          console.error('Usage: carina session share <id>');
          process.exit(1);
        }
        const base = process.env.CARINA_WEB_URL ?? resolveKnownWebGatewayUrl();
        const link = `${base}/sessions/${id}`;
        if (ctx.json) {
          console.log(JSON.stringify({ id, link }, null, 2));
          return;
        }
        console.log(link);
      },
    },
    {
      name: 'search',
      aliases: ['find'],
      description: 'Search sessions by content',
      usage: 'carina session search <query>',
      options: ['--json', '--limit <n>'],
      handler: async (ctx: GroupContext) => {
        const query = ctx.positional.join(' ');
        if (!query) {
          console.error('Usage: carina session search <query>');
          process.exit(1);
        }
        const limit = parseLimit(ctx.rawArgs);
        let results: Awaited<ReturnType<typeof searchSessions>> = [];
        try {
          await initDb();
          results = await searchSessions(query, { limit });
        } catch {
          results = [];
        }
        if (ctx.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }
        console.log(chalk.bold(`\nSession search: "${query}"\n`));
        for (const r of results) {
          console.log(`  ${r.sessionId.slice(0, 8)}  ${r.snippet.slice(0, 60)}`);
        }
        console.log('');
      },
    },
    {
      name: 'refresh-prompt',
      aliases: ['prompt-refresh'],
      description: 'Force immediate system prompt rebuild (breaks cache for this turn)',
      usage: 'carina session refresh-prompt [id]',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0] ?? process.env.CARINA_SESSION_ID;
        if (!id) {
          console.error('Usage: carina session refresh-prompt [id]');
          process.exit(1);
        }
        forceImmediateInvalidation(id);
        const payload = {
          sessionId: id,
          message: 'System prompt will rebuild on the next message. Cache miss expected on that turn.',
        };
        if (ctx.json) {
          console.log(JSON.stringify(payload, null, 2));
          return;
        }
        console.log(chalk.yellow(payload.message));
      },
    },
    {
      name: 'stats',
      description: 'Show token usage stats for a session',
      usage: 'carina session stats [id]',
      options: ['--json'],
      handler: async (ctx: GroupContext) => {
        const id = ctx.positional[0] ?? process.env.CARINA_SESSION_ID;
        if (!id) {
          console.error('Usage: carina session stats <id>');
          process.exit(1);
        }
        const file = path.join(CARINA_HOME, 'sessions', `${id}.json`);
        let stats = { sessionId: id, messageCount: 0, estimatedTokens: 0 };
        try {
          const raw = await fs.readFile(file, 'utf-8');
          const parsed = JSON.parse(raw) as { messages?: Array<{ content?: string }> };
          const text = (parsed.messages ?? []).map((m) => m.content ?? '').join(' ');
          stats = {
            sessionId: id,
            messageCount: parsed.messages?.length ?? 0,
            estimatedTokens: Math.ceil(text.length / 4),
          };
        } catch {
          // session may only exist in db
        }
        if (ctx.json) {
          console.log(JSON.stringify(stats, null, 2));
          return;
        }
        console.log(`Session ${String(id).slice(0, 8)}`);
        console.log(`  messages: ${stats.messageCount}`);
        console.log(`  est. tokens: ${stats.estimatedTokens}`);
      },
    },
  ],
};
