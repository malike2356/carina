import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { CARINA_HOME } from '../../config/paths.js';
import type { MigrationItem, MigrationOptions, MigrationReport, SourceScan } from './types.js';
import { copyIfExistsSafe, pathExists } from './copy-utils.js';

const REPORT_VERSION = 1;

function item(pathRel: string, status: MigrationItem['status'], detail?: string): MigrationItem {
  return { path: pathRel, status, detail };
}

export function claudeSourceDirs(): string[] {
  const home = os.homedir();
  return [
    path.join(home, '.claude'),
    path.join(home, '.config', 'Claude'),
    path.join(home, 'Library', 'Application Support', 'Claude'),
  ];
}

export async function scanClaudeSources(): Promise<SourceScan[]> {
  const scans: SourceScan[] = [];
  for (const dir of claudeSourceDirs()) {
    const found = await pathExists(dir);
    const hints: string[] = [];
    if (found) {
      if (await pathExists(path.join(dir, 'settings.json'))) hints.push('settings.json');
      if (await pathExists(path.join(dir, 'CLAUDE.md'))) hints.push('CLAUDE.md');
      if (await pathExists(path.join(dir, 'claude_desktop_config.json'))) hints.push('claude_desktop_config.json');
      if (await pathExists(path.join(dir, 'skills'))) hints.push('skills/');
    }
    scans.push({ source: 'claude', dir, found, hints });
  }
  return scans;
}

function pickClaudeRoot(override?: string): string | null {
  if (override && fsSync.existsSync(override)) return override;
  for (const dir of claudeSourceDirs()) {
    if (fsSync.existsSync(dir)) return dir;
  }
  return null;
}

function stripSecretsFromJson(raw: string): { safe: string; stripped: number } {
  let stripped = 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const walk = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(walk);
      if (node && typeof node === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (/api[_-]?key|token|secret|password|authorization/i.test(k) && typeof v === 'string' && v.length > 0) {
            out[k] = '<redacted-by-carina-migrate>';
            stripped++;
          } else {
            out[k] = walk(v);
          }
        }
        return out;
      }
      return node;
    };
    return { safe: JSON.stringify(walk(parsed), null, 2), stripped };
  } catch {
    return { safe: raw, stripped: 0 };
  }
}

type McpServerEntry = {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
};

function extractMcpServers(raw: string): McpServerEntry[] {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mcp = parsed.mcpServers ?? parsed.mcp_servers;
    if (!mcp || typeof mcp !== 'object') return [];
    const out: McpServerEntry[] = [];
    for (const [name, cfg] of Object.entries(mcp as Record<string, unknown>)) {
      if (!cfg || typeof cfg !== 'object') continue;
      const block = cfg as Record<string, unknown>;
      const entry: McpServerEntry = { name };
      if (typeof block.command === 'string') entry.command = block.command;
      if (Array.isArray(block.args)) entry.args = block.args.map(String);
      if (block.env && typeof block.env === 'object') {
        entry.env = {};
        for (const [k, v] of Object.entries(block.env as Record<string, unknown>)) {
          entry.env[k] = typeof v === 'string' && /secret|token|key|password/i.test(k)
            ? '<redacted>'
            : String(v);
        }
      }
      out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

function extractWorkspacePrefs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const prefs: Record<string, unknown> = {};
    for (const key of ['theme', 'fontSize', 'defaultModel', 'preferredModel', 'language']) {
      if (parsed[key] !== undefined) prefs[key] = parsed[key];
    }
    return prefs;
  } catch {
    return {};
  }
}

export async function migrateClaude(
  destDir = CARINA_HOME,
  sourceOverride?: string,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const startedAt = new Date().toISOString();
  const items: MigrationItem[] = [];
  const warnings: string[] = [
    'Claude import is partial: instructions and MCP layout only; secrets are not copied from Claude config.',
    'Review resources/claude-import/ before enabling MCP servers in Carina.',
  ];
  const manualFollowUp: string[] = [
    'Wire MCP servers manually: carina mcp server (see resources/claude-import/mcp-servers.json)',
    'Re-enter API keys in ~/.carina/.env; Claude secrets are redacted',
  ];
  const dryRun = Boolean(options.dryRun);
  const overwrite = Boolean(options.force);

  const srcDir = pickClaudeRoot(sourceOverride ?? options.sourceDir);
  if (!srcDir) {
    return {
      version: REPORT_VERSION,
      source: 'claude',
      sourceDir: '(not found)',
      destDir,
      startedAt,
      finishedAt: new Date().toISOString(),
      items: [item('(source)', 'failed', 'No Claude config directory found')],
      warnings,
      manualFollowUp,
      dryRun,
    };
  }

  if (!dryRun) {
    await fs.mkdir(destDir, { recursive: true });
    await fs.mkdir(path.join(destDir, 'resources', 'claude-import'), { recursive: true });
  }
  const importRoot = path.join(destDir, 'resources', 'claude-import');

  const claudeMd = path.join(srcDir, 'CLAUDE.md');
  if (fsSync.existsSync(claudeMd)) {
    const dest = path.join(destDir, 'personality.md');
    if (fsSync.existsSync(dest) && !overwrite) {
      if (!dryRun) await fs.copyFile(claudeMd, path.join(importRoot, 'CLAUDE.md'));
      items.push(item('resources/claude-import/CLAUDE.md', 'partial', 'personality.md exists; saved reference copy'));
      manualFollowUp.push('Merge CLAUDE.md into personality.md manually or re-run with --force');
    } else if (dryRun) {
      items.push(item('personality.md', 'imported', 'from Claude CLAUDE.md'));
    } else {
      await fs.copyFile(claudeMd, dest);
      items.push(item('personality.md', 'imported', 'from Claude CLAUDE.md'));
    }
  } else {
    items.push(item('CLAUDE.md', 'skipped'));
  }

  const mcpServers: McpServerEntry[] = [];
  let workspacePrefs: Record<string, unknown> = {};

  for (const configName of ['settings.json', 'claude_desktop_config.json']) {
    const src = path.join(srcDir, configName);
    if (!fsSync.existsSync(src)) {
      items.push(item(configName, 'skipped'));
      continue;
    }
    const raw = await fs.readFile(src, 'utf-8');
    mcpServers.push(...extractMcpServers(raw));
    if (configName === 'settings.json') workspacePrefs = extractWorkspacePrefs(raw);
    const { safe, stripped } = stripSecretsFromJson(raw);
    const dest = path.join(importRoot, configName);
    if (!dryRun) await fs.writeFile(dest, safe, { mode: 0o600 });
    items.push(item(
      `resources/claude-import/${configName}`,
      stripped > 0 ? 'partial' : 'imported',
      `${stripped} secret field(s) redacted`,
    ));
  }

  if (mcpServers.length > 0) {
    const mcpDest = path.join(importRoot, 'mcp-servers.json');
    const payload = {
      note: 'Extracted from Claude config; not auto-enabled in Carina',
      servers: mcpServers,
    };
    if (!dryRun) await fs.writeFile(mcpDest, JSON.stringify(payload, null, 2), { mode: 0o600 });
    items.push(item('resources/claude-import/mcp-servers.json', 'partial', `${mcpServers.length} server(s) mapped`));
  } else {
    items.push(item('mcp-servers.json', 'skipped', 'no mcpServers block found'));
  }

  if (Object.keys(workspacePrefs).length > 0) {
    const prefsDest = path.join(importRoot, 'workspace-preferences.json');
    if (!dryRun) {
      await fs.writeFile(prefsDest, JSON.stringify(workspacePrefs, null, 2));
    }
    items.push(item('resources/claude-import/workspace-preferences.json', 'partial', 'reference only'));
  }

  const skillsSrc = path.join(srcDir, 'skills');
  if (fsSync.existsSync(skillsSrc)) {
    if (dryRun) {
      items.push(item('resources/claude-import/skills', 'partial', 'reference copy'));
    } else {
      const status = await copyIfExistsSafe(skillsSrc, path.join(importRoot, 'skills'), overwrite);
      items.push(item('resources/claude-import/skills', 'partial', status === 'skipped' ? 'dest exists' : 'reference copy; not registered as Carina packs'));
    }
    manualFollowUp.push('Convert Claude skills to Carina packs if needed: carina packs install');
  } else {
    items.push(item('skills', 'skipped'));
  }

  const projectsDir = path.join(srcDir, 'projects');
  if (fsSync.existsSync(projectsDir)) {
    warnings.push('Claude project-level instructions were not merged automatically; inspect ~/.claude/projects if needed.');
    items.push(item('projects/', 'skipped', 'project-scoped instructions require manual review'));
    manualFollowUp.push('Review Claude project instructions under projects/ in source dir');
  }

  return {
    version: REPORT_VERSION,
    source: 'claude',
    sourceDir: srcDir,
    destDir,
    startedAt,
    finishedAt: new Date().toISOString(),
    items,
    warnings,
    manualFollowUp,
    dryRun,
  };
}
