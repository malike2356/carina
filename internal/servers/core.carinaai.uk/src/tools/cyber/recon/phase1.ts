import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import {
  clampInt,
  sanitizeDomain,
  sanitizePath,
  sanitizeTarget,
  sanitizeUrl,
} from '../sanitize.js';

export function createAmassTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target domain (alias for domain)' },
        domain: { type: 'string', description: 'Target domain' },
        mode: { type: 'string', enum: ['passive', 'active', 'full'], description: 'Enumeration mode' },
        depth: { type: 'number', description: 'Brute force depth (1-10)' },
        wordlist: { type: 'string', description: 'Custom wordlist path' },
        timeout: { type: 'number', description: 'Max seconds (default 600)' },
      },
    },
    buildArgs: (params) => {
      const domainRaw = params.domain ?? params.target;
      const domain = sanitizeDomain(domainRaw);
      if (typeof domain !== 'string') return domain;

      const mode = String(params.mode ?? 'passive');
      const depth = clampInt(params.depth, 3, 1, 10);
      const args = ['enum', '-d', domain, '-silent'];

      if (mode === 'passive') args.push('-passive');
      else if (mode === 'active') {
        args.push('-active', '-brute', '-min-for-recursive', String(depth));
      } else {
        args.push('-brute', '-min-for-recursive', String(depth));
      }

      if (params.wordlist) {
        const wordlist = sanitizePath(params.wordlist);
        if (typeof wordlist !== 'string') return wordlist;
        args.push('-w', wordlist);
      }

      return args;
    },
    formatResult: (result, params, startedAt) => {
      const domain = String(params.domain ?? params.target ?? '');
      const lines = result.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
      const subdomains = [...new Set(lines)];
      return {
        tool: 'amass',
        domain,
        mode: String(params.mode ?? 'passive'),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        count: subdomains.length,
        subdomains,
        stderr: result.stderr.trim() || undefined,
      };
    },
  });
}

const HARVESTER_SOURCES = [
  'all', 'google', 'bing', 'yahoo', 'baidu', 'shodan', 'linkedin',
  'dnsdumpster', 'virustotal', 'threatcrowd', 'crtsh', 'bufferoverun', 'anubis',
] as const;

export function parseHarvesterOutput(text: string): {
  emails: string[];
  hosts: string[];
  ips: string[];
} {
  const emails = new Set<string>();
  const hosts = new Set<string>();
  const ips = new Set<string>();

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const emailMatch = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    emailMatch?.forEach((e) => emails.add(e.toLowerCase()));
    const ipMatch = trimmed.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
    ipMatch?.forEach((ip) => ips.add(ip));
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) hosts.add(trimmed.toLowerCase());
  }

  return {
    emails: [...emails],
    hosts: [...hosts],
    ips: [...ips],
  };
}

export function createTheHarvesterTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 120_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target domain (alias for domain)' },
        domain: { type: 'string', description: 'Target domain' },
        source: { type: 'string', enum: [...HARVESTER_SOURCES], description: 'Data source' },
        limit: { type: 'number', description: 'Max results per source' },
      },
    },
    buildArgs: (params) => {
      const domainRaw = params.domain ?? params.target;
      const domain = sanitizeDomain(domainRaw);
      if (typeof domain !== 'string') return domain;

      const source = String(params.source ?? 'all');
      const limit = clampInt(params.limit, 500, 1, 5000);
      const args = ['-d', domain, '-l', String(limit)];
      if (source === 'all') args.push('-b', 'all');
      else args.push('-b', source);
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const domain = String(params.domain ?? params.target ?? '');
      const parsed = parseHarvesterOutput(result.stdout);
      return {
        tool: 'theHarvester',
        domain,
        source: String(params.source ?? 'all'),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        ...parsed,
        raw: result.stdout.trim() || undefined,
      };
    },
  });
}

export function createReconNgTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target domain (alias for domain)' },
        domain: { type: 'string', description: 'Target domain' },
        modules: {
          type: 'string',
          enum: ['discovery', 'reporting', 'expansion', 'all'],
          description: 'Module group',
        },
        workspace: { type: 'string', description: 'Workspace name' },
        moduleList: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific modules to run',
        },
      },
    },
    buildArgs: (params) => {
      const domainRaw = params.domain ?? params.target;
      const domain = sanitizeDomain(domainRaw);
      if (typeof domain !== 'string') return domain;

      const workspace = params.workspace
        ? sanitizeTarget(params.workspace)
        : `carina_${domain.replace(/\./g, '_')}`;
      if (typeof workspace !== 'string') return workspace;

      const commands = [
        `workspaces create ${workspace}`,
        `workspaces load ${workspace}`,
        `db insert domains ${domain}`,
      ];

      const moduleList = Array.isArray(params.moduleList)
        ? params.moduleList.map((m) => String(m).trim()).filter(Boolean)
        : [];

      if (moduleList.length > 0) {
        for (const mod of moduleList) commands.push(`modules load ${mod}`);
      } else {
        const group = String(params.modules ?? 'discovery');
        commands.push(`modules load ${group}`);
      }

      commands.push('show hosts');
      commands.push('show contacts');
      commands.push('show credentials');

      const args: string[] = ['-w', workspace];
      for (const cmd of commands) args.push('-C', cmd);
      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'recon-ng',
      domain: String(params.domain ?? params.target ?? ''),
      workspace: String(params.workspace ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
    }),
  });
}

export function createSpiderfootTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 1_800_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'IP, domain, email, or CIDR' },
        targetType: {
          type: 'string',
          enum: ['ip', 'domain', 'email', 'cidr', 'name', 'asn'],
          description: 'Target type',
        },
        modules: {
          type: 'string',
          enum: ['all', 'recon', 'vuln', 'darknet', 'leaks', 'passive'],
          description: 'Module group',
        },
        scanId: { type: 'string', description: 'Resume existing scan ID' },
        timeout: { type: 'number', description: 'Max seconds (default 1800)' },
      },
      required: ['target', 'targetType'],
    },
    buildArgs: (params) => {
      const target = sanitizeTarget(params.target);
      if (typeof target !== 'string') return target;

      const targetType = String(params.targetType ?? 'domain');
      const modules = String(params.modules ?? 'all');
      const args = ['-s', target, '-t', targetType.toUpperCase(), '-m', modules, '-o', 'json', '-q'];
      if (params.scanId) {
        const scanId = sanitizeTarget(params.scanId);
        if (typeof scanId !== 'string') return scanId;
        args.push('-i', scanId);
      }
      return args;
    },
    formatResult: (result, params, startedAt) => {
      let findings: unknown = result.stdout.trim();
      try {
        if (result.stdout.trim().startsWith('{') || result.stdout.trim().startsWith('[')) {
          findings = JSON.parse(result.stdout);
        }
      } catch {
        findings = result.stdout.trim();
      }
      return {
        tool: 'spiderfoot',
        target: String(params.target ?? ''),
        targetType: String(params.targetType ?? ''),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        findings,
        stderr: result.stderr.trim() || undefined,
      };
    },
  });
}

export function parseSherlockCsv(text: string): Array<{ site: string; url: string }> {
  const found: Array<{ site: string; url: string }> = [];
  for (const line of text.split('\n')) {
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 2) continue;
    if (parts[0]?.toLowerCase() === 'site') continue;
    found.push({ site: parts[0] ?? '', url: parts[1] ?? '' });
  }
  return found.filter((r) => r.site && r.url);
}

export function createSherlockTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username to search' },
        target: { type: 'string', description: 'Username alias' },
        sites: { type: 'string', enum: ['all', 'social', 'dev', 'nsfw'], description: 'Site filter' },
        timeout: { type: 'number', description: 'Per-site timeout seconds' },
        tor: { type: 'boolean', description: 'Route through Tor' },
      },
    },
    buildArgs: (params) => {
      const username = sanitizeTarget(params.username ?? params.target);
      if (typeof username !== 'string') return username;
      if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
        return { error: 'username format is invalid' };
      }

      const perSiteTimeout = clampInt(params.timeout, 60, 5, 300);
      const args = [username, '--timeout', String(perSiteTimeout), '--print-found', '--csv'];
      if (params.tor === true) args.push('--tor');
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const username = String(params.username ?? params.target ?? '');
      const accounts = parseSherlockCsv(result.stdout);
      return {
        tool: 'sherlock',
        username,
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        foundCount: accounts.length,
        accounts,
        raw: result.stdout.trim() || undefined,
      };
    },
  });
}

export function createMaltegoTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Entity value (alias for entity)' },
        entity: { type: 'string', description: 'Domain, email, IP, or name' },
        entityType: {
          type: 'string',
          enum: ['domain', 'email', 'ip', 'person', 'company'],
          description: 'Entity type',
        },
        depth: { type: 'number', description: 'Transform depth (1-5)' },
        output: { type: 'string', enum: ['json', 'png', 'pdf', 'graphml'], description: 'Output format' },
      },
      required: ['entityType'],
    },
    buildArgs: (params) => {
      const entity = sanitizeTarget(params.entity ?? params.target);
      if (typeof entity !== 'string') return entity;
      const entityType = String(params.entityType ?? 'domain');
      const depth = clampInt(params.depth, 2, 1, 5);
      const output = String(params.output ?? 'json');
      return [
        '--headless',
        '--entity', `${entityType}:${entity}`,
        '--depth', String(depth),
        '--format', output,
      ];
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'maltego',
      entity: String(params.entity ?? params.target ?? ''),
      entityType: String(params.entityType ?? ''),
      outputFormat: String(params.output ?? 'json'),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: result.stdout.trim() || result.stderr.trim(),
      note: result.exitCode !== 0
        ? 'Maltego headless mode may require GUI license or local transforms. Check binary availability.'
        : undefined,
    }),
  });
}

const DMITRY_FLAGS: Record<string, string> = {
  whois: '-w',
  subdomains: '-s',
  email: '-e',
  ports: '-p',
  banner: '-pb',
  all: '-winsepfb',
};

export function createDmitryTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 120_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Domain or IP' },
        modules: {
          type: 'string',
          enum: ['whois', 'subdomains', 'email', 'ports', 'banner', 'all'],
          description: 'Modules to run',
        },
        output: { type: 'string', description: 'Output file path' },
      },
      required: ['target'],
    },
    buildArgs: (params) => {
      const target = sanitizeTarget(params.target);
      if (typeof target !== 'string') return target;
      const modules = String(params.modules ?? 'all');
      const flag = DMITRY_FLAGS[modules] ?? DMITRY_FLAGS.all;
      const args = [flag, target];
      if (params.output) {
        const output = sanitizePath(params.output);
        if (typeof output !== 'string') return output;
        args.unshift('-o', output);
      }
      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'dmitry',
      target: String(params.target ?? ''),
      modules: String(params.modules ?? 'all'),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: result.stdout.trim() || result.stderr.trim(),
    }),
  });
}

export function createMetagoofilTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target domain (alias for domain)' },
        domain: { type: 'string', description: 'Target domain' },
        fileTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Document types: pdf, doc, xls, ppt, all',
        },
        limit: { type: 'number', description: 'Max documents per type' },
        download: { type: 'boolean', description: 'Download documents' },
        workDir: { type: 'string', description: 'Working directory' },
      },
    },
    buildArgs: (params) => {
      const domainRaw = params.domain ?? params.target;
      const domain = sanitizeDomain(domainRaw);
      if (typeof domain !== 'string') return domain;

      const limit = clampInt(params.limit, 50, 1, 500);
      const typesRaw = Array.isArray(params.fileTypes) ? params.fileTypes.map(String) : ['all'];
      const types = typesRaw.includes('all') ? 'pdf,doc,xls,ppt' : typesRaw.join(',');
      const workDir = params.workDir
        ? sanitizePath(params.workDir)
        : `/tmp/metagoofil_${Date.now()}`;
      if (typeof workDir !== 'string') return workDir;

      const args = ['-d', domain, '-t', types, '-l', String(limit), '-o', workDir, '-f', `${workDir}/results.html`];
      if (params.download !== true) args.push('-n');
      return args;
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'metagoofil',
      domain: String(params.domain ?? params.target ?? ''),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: result.stdout.trim() || result.stderr.trim(),
    }),
  });
}

function cewlOutputPath(params: Record<string, unknown>): string | { error: string } {
  if (params.output) return sanitizePath(params.output);
  const url = String(params.url ?? params.target ?? 'target');
  const slug = url.replace(/[^a-z0-9]+/gi, '_').slice(0, 48) || 'target';
  return `/tmp/cewl_${slug}.txt`;
}

export function createCewlTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL to spider' },
        target: { type: 'string', description: 'URL alias' },
        depth: { type: 'number', description: 'Spider depth (1-10)' },
        minLength: { type: 'number', description: 'Minimum word length' },
        output: { type: 'string', description: 'Output file path' },
        withCount: { type: 'boolean', description: 'Include word frequency counts' },
        email: { type: 'boolean', description: 'Include email addresses' },
        meta: { type: 'boolean', description: 'Include meta/author words' },
      },
    },
    buildArgs: (params) => {
      const url = sanitizeUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;

      const depth = clampInt(params.depth, 2, 1, 10);
      const minLength = clampInt(params.minLength, 3, 1, 32);
      const outFile = cewlOutputPath(params);
      if (typeof outFile !== 'string') return outFile;

      const args = [url, '-d', String(depth), '-m', String(minLength), '-w', outFile];
      if (params.withCount === true) args.push('-c');
      if (params.email === true) args.push('-e');
      if (params.meta === true) args.push('-a');
      return args;
    },
    formatResult: async (result, params, startedAt) => {
      const url = String(params.url ?? params.target ?? '');
      const outFile = cewlOutputPath(params);
      const filePath = typeof outFile === 'string' ? outFile : undefined;
      let wordCount = 0;
      let topWords: string[] = [];

      if (filePath) {
        try {
          const fs = await import('node:fs/promises');
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
          wordCount = lines.length;
          topWords = lines.slice(0, 20);
        } catch {
          wordCount = 0;
        }
      }

      return {
        tool: 'cewl',
        url,
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        file: filePath,
        wordCount,
        topWords,
        stderr: result.stderr.trim() || undefined,
      };
    },
  });
}
