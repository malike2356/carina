import type { Tool } from '../../../types/index.js';
import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import {
  clampInt,
  normalizeScanUrl,
  sanitizeDomain,
  sanitizePath,
  sanitizeTarget,
  sanitizeUrl,
} from '../sanitize.js';

const DEFAULT_DIR_WORDLIST = '/usr/share/wordlists/dirb/common.txt';
const DEFAULT_SECLISTS_COMMON = '/usr/share/seclists/Discovery/Web-Content/common.txt';
const DEFAULT_RAFT_MEDIUM = '/usr/share/seclists/Discovery/Web-Content/raft-medium-directories.txt';
const DEFAULT_DNS_WORDLIST = '/usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt';
const DEFAULT_GOBUSTER_DIR = '/usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt';
const DEFAULT_ARJUN_WORDLIST = '/usr/share/wordlists/arjun/large.txt';

function extensionCsv(raw: unknown, fallback: string[]): string {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).join(',');
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return fallback.join(',');
}

function extensionDotCsv(raw: unknown, fallback: string[]): string {
  const list = extensionCsv(raw, fallback).split(',').map((item) => item.trim()).filter(Boolean);
  return list.map((item) => (item.startsWith('.') ? item : `.${item}`)).join(',');
}

async function burpFetch(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const apiBase = (process.env.BURP_API_URL ?? 'http://127.0.0.1:1337/v0.1').replace(/\/$/, '');
  const apiKey = process.env.BURP_API_KEY ?? process.env.BURP_API_TOKEN ?? '';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const response = await fetch(`${apiBase}${path}`, { ...init, headers });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body,
        error: `Burp API ${response.status}: ${text.slice(0, 500)}`,
      };
    }
    return { ok: true, status: response.status, body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function createBurpTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['scan', 'proxy'], description: 'Burp action' },
        url: { type: 'string', description: 'Target URL' },
        target: { type: 'string', description: 'URL alias' },
        mode: { type: 'string', enum: ['passive', 'active'], description: 'Scan mode' },
        scope: { type: 'string', description: 'Scope filter regex' },
        loginUrl: { type: 'string', description: 'Login URL' },
        username: { type: 'string', description: 'Login username' },
        password: { type: 'string', description: 'Login password' },
        port: { type: 'number', description: 'Proxy listen port' },
        intercept: { type: 'boolean', description: 'Enable intercept' },
        proxyAction: { type: 'string', enum: ['start', 'stop', 'status'], description: 'Proxy control' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    needsConfirmation: (params) => {
      if (String(params.action ?? 'scan') === 'proxy') return false;
      return String(params.mode ?? 'passive') === 'active';
    },
    execute: async (params) => {
      const action = String(params.action ?? 'scan');
      const timeoutSec = clampInt(params.timeout, 1800, 30, 7200);

      if (action === 'proxy') {
        const proxyAction = String(params.proxyAction ?? 'status');
        if (proxyAction === 'start') {
          const port = clampInt(params.port, 8080, 1, 65535);
          const result = await burpFetch('/proxy', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              running: true,
              listen_port: port,
              intercept: params.intercept === true,
            }),
          });
          if (!result.ok) {
            return {
              tool: 'burpsuite',
              action: 'proxy',
              error: result.error,
              note: 'Burp Suite Pro REST API required. Set BURP_API_URL and BURP_API_KEY.',
            };
          }
          return { tool: 'burpsuite', action: 'proxy', status: 'running', port, body: result.body };
        }
        const result = await burpFetch('/proxy');
        return {
          tool: 'burpsuite',
          action: 'proxy',
          ok: result.ok,
          body: result.body,
          error: result.error,
        };
      }

      const url = normalizeScanUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;

      await burpFetch('/target/scope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, protocol: 'ANY' }),
      });

      if (params.loginUrl) {
        await burpFetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loginUrl: params.loginUrl,
            username: params.username,
            password: params.password,
          }),
        });
      }

      const scanMode = String(params.mode ?? 'passive') === 'active' ? 'AuditAndScan' : 'CrawlAndAudit';
      const started = await burpFetch('/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url], scan_mode: scanMode }),
      });

      if (!started.ok) {
        return {
          tool: 'burpsuite',
          action: 'scan',
          url,
          mode: String(params.mode ?? 'passive'),
          error: started.error,
          note: 'Burp Suite Pro REST API required at BURP_API_URL (default http://127.0.0.1:1337/v0.1).',
        };
      }

      const scanId = (started.body as { scan_id?: string; id?: string })?.scan_id
        ?? (started.body as { id?: string })?.id;
      if (!scanId) {
        return { tool: 'burpsuite', action: 'scan', url, started: started.body };
      }

      const deadline = Date.now() + timeoutSec * 1000;
      let statusBody: unknown = null;
      while (Date.now() < deadline) {
        const status = await burpFetch(`/scan/${scanId}`);
        statusBody = status.body;
        const scanStatus = (status.body as { scan_status?: string; status?: string })?.scan_status
          ?? (status.body as { status?: string })?.status;
        if (scanStatus === 'succeeded' || scanStatus === 'failed' || scanStatus === 'complete') break;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      const issues = await burpFetch(`/scan/${scanId}/issues`);
      return {
        tool: 'burpsuite',
        action: 'scan',
        url,
        mode: String(params.mode ?? 'passive'),
        scanId,
        status: statusBody,
        issues: issues.body,
        duration: Math.round((Date.now() - (deadline - timeoutSec * 1000)) / 1000),
      };
    },
  };
}

export function buildFfufUrl(params: Record<string, unknown>, baseUrl: string): string {
  if (baseUrl.includes('FUZZ')) return baseUrl;
  const mode = String(params.mode ?? 'dir');
  if (mode === 'vhost' || mode === 'subdomain') {
    const domain = sanitizeDomain(baseUrl.replace(/^https?:\/\//i, '').split('/')[0] ?? baseUrl);
    if (typeof domain !== 'string') return baseUrl;
    return `http://FUZZ.${domain}`;
  }
  if (mode === 'param') return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}FUZZ=test`;
  return `${baseUrl.replace(/\/$/, '')}/FUZZ`;
}

export function parseFfufJson(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return { results: [] };
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

export function createFfufTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        target: { type: 'string', description: 'URL alias' },
        wordlist: { type: 'string', description: 'Wordlist path' },
        mode: { type: 'string', enum: ['dir', 'vhost', 'param', 'subdomain'], description: 'Fuzz mode' },
        extensions: { type: 'string', description: 'Comma-separated extensions' },
        threads: { type: 'number', description: 'Concurrent threads' },
        filterCode: { type: 'string', description: 'Filter HTTP status codes' },
        matchCode: { type: 'string', description: 'Match HTTP status codes' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const urlRaw = normalizeScanUrl(params.url ?? params.target);
      if (typeof urlRaw !== 'string') return urlRaw;

      const fuzzUrl = buildFfufUrl(params, urlRaw);
      const wordlist = params.wordlist
        ? sanitizePath(params.wordlist)
        : DEFAULT_DIR_WORDLIST;
      if (typeof wordlist !== 'string') return wordlist;

      const args = [
        '-u', fuzzUrl,
        '-w', wordlist,
        '-t', String(clampInt(params.threads, 40, 1, 200)),
        '-of', 'json',
        '-o', '-',
        '-noninteractive',
      ];

      const ext = extensionDotCsv(params.extensions, ['php', 'html', 'js', 'txt', 'bak']);
      if (ext && String(params.mode ?? 'dir') === 'dir') args.push('-e', ext);
      if (params.filterCode) args.push('-fc', String(params.filterCode));
      if (params.matchCode) args.push('-mc', String(params.matchCode));
      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'ffuf',
      url: String(params.url ?? params.target ?? ''),
      mode: String(params.mode ?? 'dir'),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      report: parseFfufJson(result.stdout),
      stderr: result.stderr.trim() || undefined,
    }),
  });
}

export function createDirsearchTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        target: { type: 'string', description: 'URL alias' },
        extensions: { type: 'string', description: 'Comma-separated extensions' },
        recursive: { type: 'boolean', description: 'Enable recursion' },
        threads: { type: 'number', description: 'Thread count' },
        wordlist: { type: 'string', description: 'Wordlist path' },
        cookie: { type: 'string', description: 'Cookie header value' },
        proxy: { type: 'string', description: 'Proxy URL' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const url = normalizeScanUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;

      const wordlist = params.wordlist ? sanitizePath(params.wordlist) : DEFAULT_SECLISTS_COMMON;
      if (typeof wordlist !== 'string') return wordlist;

      const args = [
        '-u', url,
        '-e', extensionCsv(params.extensions, ['php', 'asp', 'jsp', 'html', 'js', 'txt']),
        '-t', String(clampInt(params.threads, 25, 1, 100)),
        '-w', wordlist,
        '--format', 'json',
        '-o', '-',
      ];
      if (params.recursive === true) args.push('--recursive');
      if (params.cookie) args.push('-b', String(params.cookie));
      if (params.proxy) args.push('--proxy', String(params.proxy));
      return args;
    },
    formatResult: (result, params, startedAt) => {
      let report: unknown = result.stdout.trim();
      try {
        if (result.stdout.trim()) report = JSON.parse(result.stdout);
      } catch {
        report = { raw: result.stdout.trim() };
      }
      return {
        tool: 'dirsearch',
        url: String(params.url ?? params.target ?? ''),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        report,
      };
    },
  });
}

export function parseFeroxbusterLines(stdout: string): unknown[] {
  const rows: unknown[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      // skip
    }
  }
  return rows;
}

export function createFeroxbusterTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        target: { type: 'string', description: 'URL alias' },
        depth: { type: 'number', description: 'Recursion depth' },
        extensions: { type: 'string', description: 'Space-separated extensions' },
        threads: { type: 'number', description: 'Concurrent threads' },
        wordlist: { type: 'string', description: 'Wordlist path' },
        filterStatus: { type: 'string', description: 'Comma-separated status codes to filter' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const url = normalizeScanUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;

      const wordlist = params.wordlist ? sanitizePath(params.wordlist) : DEFAULT_RAFT_MEDIUM;
      if (typeof wordlist !== 'string') return wordlist;

      const exts = extensionCsv(params.extensions, ['php', 'html', 'js', 'txt']).split(',');
      const args = [
        '-u', url,
        '-w', wordlist,
        '-d', String(clampInt(params.depth, 3, 1, 10)),
        '-t', String(clampInt(params.threads, 50, 1, 200)),
        '--filter-status', String(params.filterStatus ?? '404'),
        '--json',
        '-o', '-',
      ];
      if (exts.length > 0) args.push('-x', exts.join(','));
      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'feroxbuster',
      url: String(params.url ?? params.target ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      results: parseFeroxbusterLines(result.stdout),
      stderr: result.stderr.trim() || undefined,
    }),
  });
}

export function parseGobusterOutput(text: string): string[] {
  const paths: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('Gobuster')) continue;
    const match = trimmed.match(/(?:\/|\()([\w./_-]+)/);
    if (match?.[1]) paths.push(match[1]);
    else if (trimmed.includes('Found:')) paths.push(trimmed.replace(/^Found:\s*/i, ''));
    else if (/^\/\S+/.test(trimmed)) paths.push(trimmed.split(/\s+/)[0] ?? trimmed);
  }
  return [...new Set(paths.filter(Boolean))];
}

export function createGobusterTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['dir', 'dns', 'vhost', 's3'], description: 'Gobuster mode' },
        target: { type: 'string', description: 'Target URL, domain, or bucket prefix' },
        url: { type: 'string', description: 'Target alias' },
        wordlist: { type: 'string', description: 'Wordlist path' },
        threads: { type: 'number', description: 'Threads' },
        extensions: { type: 'string', description: 'Comma-separated extensions (dir mode)' },
        statusCodes: { type: 'string', description: 'Accepted status codes' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['mode'],
    },
    buildArgs: (params) => {
      const mode = String(params.mode ?? 'dir');
      const targetRaw = String(params.target ?? params.url ?? '').trim();
      if (!targetRaw) return { error: 'target is required' };

      const defaultWl = mode === 'dns' ? DEFAULT_DNS_WORDLIST : DEFAULT_GOBUSTER_DIR;
      const wordlist = params.wordlist ? sanitizePath(params.wordlist) : defaultWl;
      if (typeof wordlist !== 'string') return wordlist;

      const args = [
        mode,
        '-w', wordlist,
        '-t', String(clampInt(params.threads, 10, 1, 100)),
        '-s', String(params.statusCodes ?? '200,204,301,302,307,401,403,405'),
        '-o', '-',
        '--no-error',
      ];

      if (mode === 'dns') {
        const domain = sanitizeDomain(targetRaw.replace(/^https?:\/\//i, '').split('/')[0] ?? targetRaw);
        if (typeof domain !== 'string') return domain;
        args.splice(1, 0, '-d', domain);
      } else {
        const url = mode === 'dir' || mode === 'vhost'
          ? normalizeScanUrl(targetRaw)
          : sanitizeTarget(targetRaw);
        if (typeof url !== 'string') return url;
        args.splice(1, 0, '-u', url);
      }

      if (mode === 'dir' && params.extensions) {
        args.push('-x', extensionCsv(params.extensions, ['php', 'html', 'txt']));
      }

      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'gobuster',
      mode: String(params.mode ?? 'dir'),
      target: String(params.target ?? params.url ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      paths: parseGobusterOutput(result.stdout),
      raw: result.stdout.trim() || undefined,
    }),
  });
}

export function createArjunTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 120_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        target: { type: 'string', description: 'URL alias' },
        method: { type: 'string', enum: ['GET', 'POST', 'JSON', 'XML'], description: 'HTTP method' },
        wordlist: { type: 'string', description: 'Parameter wordlist' },
        threads: { type: 'number', description: 'Threads' },
        headers: { type: 'object', description: 'Custom headers object' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const url = normalizeScanUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;

      const wordlist = params.wordlist ? sanitizePath(params.wordlist) : DEFAULT_ARJUN_WORDLIST;
      if (typeof wordlist !== 'string') return wordlist;

      const args = [
        '-u', url,
        '-m', String(params.method ?? 'GET'),
        '-w', wordlist,
        '-t', String(clampInt(params.threads, 10, 1, 50)),
        '-oJ', '-',
      ];

      if (params.headers && typeof params.headers === 'object') {
        args.push('-H', JSON.stringify(params.headers));
      }

      return args;
    },
    formatResult: (result, params, startedAt) => {
      let report: unknown = result.stdout.trim();
      try {
        if (result.stdout.trim()) report = JSON.parse(result.stdout);
      } catch {
        report = { raw: result.stdout.trim() };
      }
      return {
        tool: 'arjun',
        url: String(params.url ?? params.target ?? ''),
        method: String(params.method ?? 'GET'),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        report,
      };
    },
  });
}

export function parseSstimapOutput(stdout: string): Record<string, unknown> {
  const engine = stdout.match(/Engine:\s*(\w+)/i)?.[1];
  const vulnerable = /vulnerable|injection found|is injectable/i.test(stdout);
  return { engine, vulnerable, summary: stdout.trim() };
}

export function createSstimapTool(def: CyberToolDef) {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 120_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        target: { type: 'string', description: 'URL alias' },
        param: { type: 'string', description: 'Parameter name to test' },
        data: { type: 'string', description: 'POST body' },
        cookie: { type: 'string', description: 'Cookie header' },
        engine: { type: 'string', description: 'Template engine or auto' },
        osShell: { type: 'boolean', description: 'Attempt RCE via SSTI' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const url = normalizeScanUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;

      const args = ['-u', url, '--engine', String(params.engine ?? 'auto')];
      if (params.param) args.push('-p', String(params.param));
      if (params.data) args.push('--data', String(params.data));
      if (params.cookie) args.push('--cookie', String(params.cookie));
      if (params.osShell === true) args.push('--os-shell');
      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'sstimap',
      url: String(params.url ?? params.target ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      ...parseSstimapOutput(result.stdout),
      stderr: result.stderr.trim() || undefined,
    }),
  });

  tool.needsConfirmation = (params) => params.osShell === true;
  return tool;
}
