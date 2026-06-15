import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { URL } from 'node:url';
import YAML from 'yaml';
import { Cron } from 'croner';
import type { Tool } from '../types/index.js';

const execFileAsync = promisify(execFile);

function textResult(data: Record<string, unknown>): Record<string, unknown> {
  return data;
}

export const jsonFormatTool: Tool = {
  name: 'json-format',
  description: 'Parse, validate, pretty-print, or minify JSON text.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['parse', 'pretty', 'minify', 'validate'] },
      text: { type: 'string' },
      indent: { type: 'number' },
    },
    required: ['action', 'text'],
  },
  execute: async (params) => {
    const action = String(params.action ?? 'parse');
    const text = String(params.text ?? '');
    try {
      const parsed = JSON.parse(text);
      if (action === 'validate') return textResult({ valid: true });
      if (action === 'minify') return textResult({ output: JSON.stringify(parsed) });
      const indent = Number(params.indent ?? 2);
      return textResult({ output: JSON.stringify(parsed, null, action === 'pretty' ? indent : 0), value: parsed });
    } catch (err) {
      return textResult({ valid: false, error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const textHashTool: Tool = {
  name: 'text-hash',
  description: 'Compute SHA-256, SHA-1, or MD5 digests for text input.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      algorithm: { type: 'string', enum: ['sha256', 'sha1', 'md5'] },
    },
    required: ['text'],
  },
  execute: async (params) => {
    const text = String(params.text ?? '');
    const algorithm = String(params.algorithm ?? 'sha256') as 'sha256' | 'sha1' | 'md5';
    const hash = crypto.createHash(algorithm).update(text, 'utf8').digest('hex');
    return textResult({ algorithm, hash });
  },
};

export const uuidGenerateTool: Tool = {
  name: 'uuid-generate',
  description: 'Generate one or more random UUID v4 values.',
  parameters: {
    type: 'object',
    properties: { count: { type: 'number' } },
  },
  execute: async (params) => {
    const count = Math.min(Math.max(Number(params.count ?? 1), 1), 20);
    const uuids = Array.from({ length: count }, () => crypto.randomUUID());
    return textResult({ uuids, count: uuids.length });
  },
};

export const timestampConvertTool: Tool = {
  name: 'timestamp-convert',
  description: 'Convert between Unix epoch seconds and ISO-8601 timestamps.',
  parameters: {
    type: 'object',
    properties: {
      value: { type: 'string' },
      timezone: { type: 'string', description: 'IANA timezone for display only' },
    },
    required: ['value'],
  },
  execute: async (params) => {
    const raw = String(params.value ?? '').trim();
    const numeric = Number(raw);
    const date = Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(raw)
      ? new Date(numeric > 1e12 ? numeric : numeric * 1000)
      : new Date(raw);
    if (Number.isNaN(date.getTime())) return textResult({ error: 'invalid timestamp' });
    const tz = String(params.timezone ?? 'UTC');
    let local: string | undefined;
    try {
      local = new Intl.DateTimeFormat('en-GB', { timeZone: tz, dateStyle: 'medium', timeStyle: 'long' }).format(date);
    } catch {
      local = undefined;
    }
    return textResult({
      iso: date.toISOString(),
      unixSeconds: Math.floor(date.getTime() / 1000),
      unixMillis: date.getTime(),
      localInTimezone: local,
      timezone: tz,
    });
  },
};

export const base64CodecTool: Tool = {
  name: 'base64-codec',
  description: 'Encode or decode UTF-8 text with base64.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['encode', 'decode'] },
      text: { type: 'string' },
    },
    required: ['action', 'text'],
  },
  execute: async (params) => {
    const action = String(params.action ?? 'encode');
    const text = String(params.text ?? '');
    if (action === 'encode') {
      return textResult({ output: Buffer.from(text, 'utf8').toString('base64') });
    }
    try {
      return textResult({ output: Buffer.from(text, 'base64').toString('utf8') });
    } catch (err) {
      return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const urlParseTool: Tool = {
  name: 'url-parse',
  description: 'Parse a URL into components or build a URL from parts.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['parse', 'build'] },
      url: { type: 'string' },
      protocol: { type: 'string' },
      host: { type: 'string' },
      pathname: { type: 'string' },
      search: { type: 'string' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? 'parse');
    if (action === 'build') {
      const built = new URL(String(params.pathname ?? '/'), `${params.protocol ?? 'https'}://${params.host ?? 'localhost'}`);
      if (params.search) built.search = String(params.search).replace(/^\?/, '');
      return textResult({ url: built.toString() });
    }
    try {
      const parsed = new URL(String(params.url ?? ''));
      const query: Record<string, string> = {};
      parsed.searchParams.forEach((v, k) => { query[k] = v; });
      return textResult({
        href: parsed.href,
        protocol: parsed.protocol,
        host: parsed.host,
        pathname: parsed.pathname,
        search: parsed.search,
        hash: parsed.hash,
        query,
      });
    } catch (err) {
      return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const markdownToTextTool: Tool = {
  name: 'markdown-to-text',
  description: 'Strip markdown syntax to plain text for summaries or TTS.',
  parameters: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
  execute: async (params) => {
    let text = String(params.text ?? '');
    text = text.replace(/```[\s\S]*?```/g, ' ');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/!\[[^\]]*]\([^)]+\)/g, '');
    text = text.replace(/\[([^\]]+)]\([^)]+\)/g, '$1');
    text = text.replace(/^#{1,6}\s+/gm, '');
    text = text.replace(/[*_~]/g, '');
    text = text.replace(/\s+/g, ' ').trim();
    return textResult({ output: text, length: text.length });
  },
};

export const textDiffTool: Tool = {
  name: 'text-diff',
  description: 'Line-level diff between two text blobs (read-only).',
  parameters: {
    type: 'object',
    properties: {
      before: { type: 'string' },
      after: { type: 'string' },
    },
    required: ['before', 'after'],
  },
  execute: async (params) => {
    const before = String(params.before ?? '').split('\n');
    const after = String(params.after ?? '').split('\n');
    const max = Math.max(before.length, after.length);
    const changes: Array<{ line: number; type: 'same' | 'removed' | 'added' | 'changed'; before?: string; after?: string }> = [];
    for (let i = 0; i < max; i++) {
      const a = before[i];
      const b = after[i];
      if (a === b) changes.push({ line: i + 1, type: 'same', before: a, after: b });
      else if (a === undefined) changes.push({ line: i + 1, type: 'added', after: b });
      else if (b === undefined) changes.push({ line: i + 1, type: 'removed', before: a });
      else changes.push({ line: i + 1, type: 'changed', before: a, after: b });
    }
    const summary = {
      added: changes.filter((c) => c.type === 'added').length,
      removed: changes.filter((c) => c.type === 'removed').length,
      changed: changes.filter((c) => c.type === 'changed').length,
    };
    return textResult({ summary, changes: changes.filter((c) => c.type !== 'same').slice(0, 200) });
  },
};

export const randomStringTool: Tool = {
  name: 'random-string',
  description: 'Generate random alphanumeric strings or tokens.',
  parameters: {
    type: 'object',
    properties: {
      length: { type: 'number' },
      charset: { type: 'string', enum: ['alnum', 'hex', 'base64url'] },
    },
  },
  execute: async (params) => {
    const length = Math.min(Math.max(Number(params.length ?? 16), 4), 128);
    const charset = String(params.charset ?? 'alnum');
    if (charset === 'hex') {
      return textResult({ value: crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length) });
    }
    if (charset === 'base64url') {
      return textResult({ value: crypto.randomBytes(length).toString('base64url').slice(0, length) });
    }
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = crypto.randomBytes(length);
    let value = '';
    for (let i = 0; i < length; i++) value += alphabet[bytes[i]! % alphabet.length];
    return textResult({ value, length });
  },
};

export const unitConvertTool: Tool = {
  name: 'unit-convert',
  description: 'Convert common units: bytes, Celsius/Fahrenheit, kilometers/miles.',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['bytes', 'temperature', 'distance'] },
      value: { type: 'number' },
      from: { type: 'string' },
      to: { type: 'string' },
    },
    required: ['kind', 'value', 'from', 'to'],
  },
  execute: async (params) => {
    const kind = String(params.kind ?? '');
    const value = Number(params.value);
    const from = String(params.from ?? '').toLowerCase();
    const to = String(params.to ?? '').toLowerCase();
    if (!Number.isFinite(value)) return textResult({ error: 'invalid value' });

    if (kind === 'bytes') {
      const units: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
      const base = value * (units[from] ?? 1);
      const converted = base / (units[to] ?? 1);
      return textResult({ value, from, to, result: converted });
    }
    if (kind === 'temperature') {
      let c = value;
      if (from.startsWith('f')) c = (value - 32) * (5 / 9);
      if (from.startsWith('k')) c = value - 273.15;
      let result = c;
      if (to.startsWith('f')) result = c * (9 / 5) + 32;
      if (to.startsWith('k')) result = c + 273.15;
      return textResult({ value, from, to, result });
    }
    if (kind === 'distance') {
      const toKm = from === 'mi' ? value * 1.60934 : value;
      const result = to === 'mi' ? toKm / 1.60934 : toKm;
      return textResult({ value, from, to, result });
    }
    return textResult({ error: `unknown kind: ${kind}` });
  },
};

export const semverCompareTool: Tool = {
  name: 'semver-compare',
  description: 'Compare two semantic version strings.',
  parameters: {
    type: 'object',
    properties: {
      left: { type: 'string' },
      right: { type: 'string' },
    },
    required: ['left', 'right'],
  },
  execute: async (params) => {
    const parse = (v: string) => v.replace(/^v/, '').split(/[.-]/).map((p) => Number.parseInt(p, 10) || 0);
    const left = parse(String(params.left ?? '0'));
    const right = parse(String(params.right ?? '0'));
    const len = Math.max(left.length, right.length);
    let cmp = 0;
    for (let i = 0; i < len; i++) {
      const diff = (left[i] ?? 0) - (right[i] ?? 0);
      if (diff !== 0) { cmp = diff > 0 ? 1 : -1; break; }
    }
    return textResult({
      left: params.left,
      right: params.right,
      comparison: cmp === 0 ? 'equal' : cmp > 0 ? 'left_newer' : 'right_newer',
    });
  },
};

export const regexTestTool: Tool = {
  name: 'regex-test',
  description: 'Test a regular expression against sample text.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
      flags: { type: 'string' },
      text: { type: 'string' },
    },
    required: ['pattern', 'text'],
  },
  execute: async (params) => {
    try {
      const re = new RegExp(String(params.pattern ?? ''), String(params.flags ?? ''));
      const text = String(params.text ?? '');
      const matches = [...text.matchAll(re)].slice(0, 50).map((m) => ({
        match: m[0],
        groups: m.groups ?? {},
        index: m.index,
      }));
      return textResult({ matches, count: matches.length });
    } catch (err) {
      return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const slugifyTextTool: Tool = {
  name: 'slugify-text',
  description: 'Convert text to URL-safe slugs.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      maxLength: { type: 'number' },
    },
    required: ['text'],
  },
  execute: async (params) => {
    const maxLength = Number(params.maxLength ?? 64);
    const slug = String(params.text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, maxLength);
    return textResult({ slug });
  },
};

export const csvParseTool: Tool = {
  name: 'csv-parse',
  description: 'Parse simple CSV text into rows (no embedded comma edge cases).',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      delimiter: { type: 'string' },
      hasHeader: { type: 'boolean' },
    },
    required: ['text'],
  },
  execute: async (params) => {
    const delimiter = String(params.delimiter ?? ',');
    const lines = String(params.text ?? '').trim().split(/\r?\n/).filter(Boolean);
    const rows = lines.map((line) => line.split(delimiter).map((c) => c.trim()));
    const hasHeader = params.hasHeader !== false && rows.length > 0;
    const header = hasHeader ? rows[0] : undefined;
    const data = hasHeader ? rows.slice(1) : rows;
    return textResult({ header, rows: data.slice(0, 200), totalRows: data.length });
  },
};

export const ipParseTool: Tool = {
  name: 'ip-parse',
  description: 'Validate and classify IPv4/IPv6 addresses (no network lookup).',
  parameters: {
    type: 'object',
    properties: { address: { type: 'string' } },
    required: ['address'],
  },
  execute: async (params) => {
    const address = String(params.address ?? '').trim();
    const isV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(address)
      && address.split('.').every((oct) => Number(oct) >= 0 && Number(oct) <= 255);
    const isV6 = address.includes(':');
    const isPrivateV4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address);
    return textResult({ address, valid: isV4 || isV6, family: isV4 ? 'ipv4' : isV6 ? 'ipv6' : 'unknown', private: isPrivateV4 });
  },
};

export const envPresenceTool: Tool = {
  name: 'env-presence',
  description: 'Check whether env keys are set (names only; never returns values).',
  parameters: {
    type: 'object',
    properties: {
      keys: { type: 'array', items: { type: 'string' } },
    },
    required: ['keys'],
  },
  execute: async (params) => {
    const keys = Array.isArray(params.keys) ? params.keys.map(String) : [];
    const results = keys.map((key) => ({
      key,
      present: Boolean(process.env[key]?.trim()),
    }));
    return textResult({ results, presentCount: results.filter((r) => r.present).length });
  },
};

export const cronExplainTool: Tool = {
  name: 'cron-explain',
  description: 'Validate a cron expression and show the next run times.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string' },
      count: { type: 'number' },
      timezone: { type: 'string' },
    },
    required: ['expression'],
  },
  execute: async (params) => {
    const expression = String(params.expression ?? '').trim();
    const count = Math.min(Math.max(Number(params.count ?? 5), 1), 20);
    const timezone = String(params.timezone ?? 'UTC');
    try {
      const job = new Cron(expression, { timezone, paused: true });
      const next = job.nextRuns(count).map((d) => d.toISOString());
      return textResult({ valid: true, expression, timezone, nextRuns: next });
    } catch (err) {
      return textResult({ valid: false, error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const rssFetchTool: Tool = {
  name: 'rss-fetch',
  description: 'Fetch and parse a simple RSS/Atom feed (title, items, links).',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['url'],
  },
  execute: async (params) => {
    const url = String(params.url ?? '');
    const limit = Math.min(Math.max(Number(params.limit ?? 10), 1), 30);
    const res = await fetch(url, { headers: { 'User-Agent': 'Carina/rss-fetch' } });
    if (!res.ok) return textResult({ error: `HTTP ${res.status}` });
    const xml = await res.text();
    const title = xml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const itemBlocks = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi), ...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)];
    const items = itemBlocks.slice(0, limit).map((block) => {
      const text = block[0] ?? '';
      return {
        title: text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim(),
        link: text.match(/<link[^>]*>([^<]+)<\/link>/i)?.[1]?.trim()
          ?? text.match(/<link[^>]+href="([^"]+)"/i)?.[1]?.trim(),
        pubDate: text.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i)?.[1]?.trim()
          ?? text.match(/<updated[^>]*>([^<]+)<\/updated>/i)?.[1]?.trim(),
      };
    });
    return textResult({ title, itemCount: items.length, items });
  },
};

export const researchListTool: Tool = {
  name: 'research-list',
  description: 'List saved deep-research reports from ~/.carina/research.',
  parameters: {
    type: 'object',
    properties: { limit: { type: 'number' } },
  },
  execute: async (params) => {
    const { listResearchReports } = await import('../research/research-store.js');
    const limit = Math.min(Math.max(Number(params.limit ?? 20), 1), 50);
    const reports = await listResearchReports(limit);
    return textResult({
      count: reports.length,
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        query: r.query,
        shareId: r.shareId,
        createdAt: r.createdAt,
        sourceCount: r.sourceCount,
      })),
    });
  },
};

export const learningStatusTool: Tool = {
  name: 'learning-status',
  description: 'Read self-improvement loop metrics (events, drafts, curator).',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const { getLearningLoopMetrics } = await import('../skills/learning-ops.js');
    const metrics = await getLearningLoopMetrics();
    return textResult(metrics as unknown as Record<string, unknown>);
  },
};

export const capabilitiesAuditTool: Tool = {
  name: 'capabilities-audit',
  description: 'Audit tool, skill, and channel counts versus operator targets.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const { buildCapabilityAudit } = await import('../capabilities/audit.js');
    const audit = await buildCapabilityAudit();
    return textResult({
      targets: audit.targets,
      tools: {
        registered: audit.tools.registered,
        gap: audit.tools.gap,
        status: audit.tools.status,
      },
      skills: audit.skills,
      channels: {
        total: audit.channels.total,
        gap: audit.channels.gap,
        status: audit.channels.status,
        connected: audit.channels.connected,
      },
      health: audit.health,
    });
  },
};

export const channelStatusSnapshotTool: Tool = {
  name: 'channel-status-snapshot',
  description: 'Summarize channel adapter health and configuration states.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const { getChannelStatusReports } = await import('../gateway/channels/channel-status.js');
    const reports = getChannelStatusReports();
    return textResult({
      total: reports.length,
      byState: reports.reduce<Record<string, number>>((acc, r) => {
        acc[r.state] = (acc[r.state] ?? 0) + 1;
        return acc;
      }, {}),
      channels: reports.map((r) => ({
        channel: r.channel,
        state: r.state,
        active: r.active,
        transport: r.transport,
      })),
    });
  },
};

export const yamlJsonConvertTool: Tool = {
  name: 'yaml-json-convert',
  description: 'Convert between YAML and JSON text.',
  parameters: {
    type: 'object',
    properties: {
      direction: { type: 'string', enum: ['yaml-to-json', 'json-to-yaml'] },
      text: { type: 'string' },
    },
    required: ['direction', 'text'],
  },
  execute: async (params) => {
    const direction = String(params.direction ?? '');
    const text = String(params.text ?? '');
    try {
      if (direction === 'yaml-to-json') {
        const parsed = YAML.parse(text);
        return textResult({ output: JSON.stringify(parsed, null, 2) });
      }
      const parsed = JSON.parse(text);
      return textResult({ output: YAML.stringify(parsed) });
    } catch (err) {
      return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const colorConvertTool: Tool = {
  name: 'color-convert',
  description: 'Convert hex colors to RGB tuples and back.',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' },
      format: { type: 'string', enum: ['hex', 'rgb'] },
    },
    required: ['input'],
  },
  execute: async (params) => {
    const input = String(params.input ?? '').trim();
    const format = String(params.format ?? 'hex');
    if (format === 'hex' || input.startsWith('#')) {
      const hex = input.replace('#', '');
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) return textResult({ error: 'invalid hex' });
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      return textResult({ rgb: { r, g, b }, hex: `#${hex.toLowerCase()}` });
    }
    const m = input.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return textResult({ error: 'invalid rgb' });
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    return textResult({ rgb: { r, g, b }, hex });
  },
};

export const gitBriefStatusTool: Tool = {
  name: 'git-brief-status',
  description: 'Read-only git status summary for a repository path.',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' } },
  },
  execute: async (params) => {
    const cwd = String(params.path ?? process.cwd());
    try {
      const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
      const { stdout: porcelain } = await execFileAsync('git', ['status', '--porcelain'], { cwd });
      const lines = porcelain.trim().split('\n').filter(Boolean);
      return textResult({
        path: cwd,
        branch: branch.trim(),
        changedFiles: lines.length,
        sample: lines.slice(0, 20),
      });
    } catch (err) {
      return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const diskUsageTool: Tool = {
  name: 'disk-usage',
  description: 'Summarize file or directory size on disk (local path).',
  parameters: {
    type: 'object',
    properties: { path: { type: 'string' } },
    required: ['path'],
  },
  execute: async (params) => {
    const target = String(params.path ?? '');
    try {
      const stat = await fs.stat(target);
      if (!stat.isDirectory()) {
        return textResult({ path: target, bytes: stat.size, type: 'file' });
      }
      let bytes = 0;
      let files = 0;
      const walk = async (dir: string) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = `${dir}/${entry.name}`;
          if (entry.isDirectory()) await walk(full);
          else {
            const s = await fs.stat(full);
            bytes += s.size;
            files += 1;
          }
        }
      };
      await walk(target);
      return textResult({ path: target, bytes, files, type: 'directory' });
    } catch (err) {
      return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const hexEncodeTool: Tool = {
  name: 'hex-encode',
  description: 'Encode UTF-8 text to hex or decode hex to text.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['encode', 'decode'] },
      text: { type: 'string' },
    },
    required: ['action', 'text'],
  },
  execute: async (params) => {
    const action = String(params.action ?? 'encode');
    const text = String(params.text ?? '');
    if (action === 'encode') {
      return textResult({ output: Buffer.from(text, 'utf8').toString('hex') });
    }
    try {
      return textResult({ output: Buffer.from(text.replace(/\s+/g, ''), 'hex').toString('utf8') });
    } catch (err) {
      return textResult({ error: err instanceof Error ? err.message : String(err) });
    }
  },
};

export const OPERATOR_UTILITY_TOOLS: Tool[] = [
  jsonFormatTool,
  textHashTool,
  uuidGenerateTool,
  timestampConvertTool,
  base64CodecTool,
  urlParseTool,
  markdownToTextTool,
  textDiffTool,
  randomStringTool,
  unitConvertTool,
  semverCompareTool,
  regexTestTool,
  slugifyTextTool,
  csvParseTool,
  ipParseTool,
  envPresenceTool,
  cronExplainTool,
  rssFetchTool,
  researchListTool,
  learningStatusTool,
  capabilitiesAuditTool,
  channelStatusSnapshotTool,
  yamlJsonConvertTool,
  colorConvertTool,
  gitBriefStatusTool,
  diskUsageTool,
  hexEncodeTool,
];
