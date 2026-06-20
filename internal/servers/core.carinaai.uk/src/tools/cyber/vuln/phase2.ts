import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import {
  clampInt,
  normalizeScanUrl,
  parseSeverityList,
  sanitizeInterface,
  sanitizePath,
  sanitizeTarget,
  sanitizeUrl,
} from '../sanitize.js';

const UNSAFE_PROXY = /[;&|`$<>]/;

export const NUCLEI_TEMPLATE_FLAGS: Record<string, string[]> = {
  all: ['-as'],
  cve: ['-tags', 'cve'],
  misconfig: ['-tags', 'misconfig'],
  exposures: ['-tags', 'exposure'],
  tech: ['-tags', 'tech'],
  'default-logins': ['-tags', 'default-login'],
  dast: ['-tags', 'dast'],
  secrets: ['-tags', 'token,exposure'],
};

export function parseNucleiFindings(stdout: string): unknown[] {
  const findings: unknown[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      findings.push(JSON.parse(trimmed));
    } catch {
      // skip malformed jsonl rows
    }
  }
  return findings;
}

export function createNucleiTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'URL, host, IP, or file of targets' },
        templates: {
          type: 'string',
          enum: ['all', 'cve', 'misconfig', 'exposures', 'tech', 'default-logins', 'dast', 'secrets'],
          description: 'Template category',
        },
        severity: { type: 'string', description: 'Comma-separated severities or array' },
        rateLimit: { type: 'number', description: 'Requests per second (default 150)' },
        customTemplates: { type: 'string', description: 'Path to custom template directory' },
        timeout: { type: 'number', description: 'Max seconds (default 600)' },
        proxy: { type: 'string', description: 'Proxy URL (http://127.0.0.1:8080)' },
      },
      required: ['target'],
    },
    buildArgs: (params) => {
      const target = normalizeScanUrl(params.target);
      if (typeof target !== 'string') return target;

      const templates = String(params.templates ?? 'all');
      const templateFlags = NUCLEI_TEMPLATE_FLAGS[templates] ?? NUCLEI_TEMPLATE_FLAGS.all;
      const severity = parseSeverityList(params.severity);
      const rateLimit = clampInt(params.rateLimit, 150, 1, 500);
      const scanTimeout = clampInt(params.timeout, 600, 30, 3600);

      const args = ['-u', target, ...templateFlags, '-severity', severity, '-rl', String(rateLimit), '-jsonl', '-stats', '-timeout', String(scanTimeout)];

      if (params.customTemplates) {
        const custom = sanitizePath(params.customTemplates);
        if (typeof custom !== 'string') return custom;
        args.push('-t', custom);
      }

      if (params.proxy) {
        const proxy = String(params.proxy).trim();
        if (UNSAFE_PROXY.test(proxy)) return { error: 'proxy URL contains invalid characters' };
        args.push('-proxy', proxy);
      }

      return args;
    },
    formatResult: (result, params, startedAt) => {
      const target = String(params.target ?? '');
      const findings = parseNucleiFindings(result.stdout);
      return {
        tool: 'nuclei',
        target,
        templates: String(params.templates ?? 'all'),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        findingCount: findings.length,
        findings,
        stderr: result.stderr.trim() || undefined,
      };
    },
  });
}

function niktoTuningFlag(raw: unknown): string {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean).join('');
  }
  const text = String(raw ?? '123456789').trim();
  return text || '123456789';
}

export function parseNiktoJson(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return { findings: [] };
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed, findings: [] };
  }
}

export function createNiktoTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Host or IP' },
        port: { type: 'number', description: 'Port (default 80 or 443 with ssl)' },
        ssl: { type: 'boolean', description: 'Use SSL/TLS' },
        tuning: { type: 'string', description: 'Tuning digits 1-9' },
        hostHeader: { type: 'string', description: 'Host header value' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['target'],
    },
    buildArgs: (params) => {
      const host = sanitizeTarget(params.target);
      if (typeof host !== 'string') return host;

      const ssl = params.ssl === true;
      const port = clampInt(params.port, ssl ? 443 : 80, 1, 65535);
      const args = ['-h', host, '-p', String(port), '-T', niktoTuningFlag(params.tuning), '-Format', 'json', '-output', '-'];
      if (ssl) args.push('-ssl');
      if (params.hostHeader) {
        const id = sanitizeTarget(params.hostHeader);
        if (typeof id !== 'string') return id;
        args.push('-id', id);
      }
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const host = String(params.target ?? '');
      const ssl = params.ssl === true;
      const port = clampInt(params.port, ssl ? 443 : 80, 1, 65535);
      const parsed = parseNiktoJson(result.stdout);
      return {
        tool: 'nikto',
        target: `${ssl ? 'https' : 'http'}://${host}:${port}`,
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        report: parsed,
        stderr: result.stderr.trim() || undefined,
      };
    },
  });
}

export function parseSqlmapSummary(stdout: string, stderr: string): Record<string, unknown> {
  const text = `${stdout}\n${stderr}`;
  const vulnerable = /sqlmap identified the following injection point/i.test(text)
    || /Parameter:/i.test(text)
    || /Type: /i.test(text);
  const dbms = text.match(/back-end DBMS:\s*(.+)/i)?.[1]?.trim();
  const parameters = [...text.matchAll(/Parameter:\s*(.+)/gi)].map((match) => match[1]?.trim()).filter(Boolean);
  return {
    vulnerable,
    dbms,
    parameters,
    summary: text.trim(),
  };
}

function sqlmapOutputDir(url: string): string {
  const slug = url.replace(/[^a-z0-9]+/gi, '_').slice(0, 48) || 'scan';
  return `/tmp/sqlmap_carina_${slug}`;
}

function resolveHttpUrl(raw: unknown): string | { error: string } {
  const input = String(raw ?? '').trim();
  if (!input) return { error: 'url is required' };
  if (/^https?:\/\//i.test(input)) return sanitizeUrl(input);
  return sanitizeUrl(`https://${input}`);
}

export function createSqlmapTool(def: CyberToolDef) {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        target: { type: 'string', description: 'URL alias' },
        data: { type: 'string', description: 'POST data string' },
        cookie: { type: 'string', description: 'Session cookie' },
        level: { type: 'number', description: 'Test depth 1-5' },
        risk: { type: 'number', description: 'Risk 1-3' },
        dump: { type: 'boolean', description: 'Automatically dump found tables' },
        dbms: { type: 'string', description: 'Force DBMS type' },
        technique: { type: 'string', description: 'SQLi techniques (BEUSTQ)' },
        batch: { type: 'boolean', description: 'Non-interactive mode' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: [],
    },
    buildArgs: (params) => {
      const url = resolveHttpUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;

      const level = clampInt(params.level, 1, 1, 5);
      const risk = clampInt(params.risk, 1, 1, 3);
      const technique = String(params.technique ?? 'BEUSTQ').trim();
      if (!/^[BEUSTQ]+$/i.test(technique)) {
        return { error: 'technique must contain only letters B,E,U,S,T,Q' };
      }

      const outDir = sqlmapOutputDir(url);
      const args = ['-u', url, '--level', String(level), '--risk', String(risk), `--technique=${technique}`, '--batch', '--output-dir', outDir];

      if (params.data) args.push('--data', String(params.data));
      if (params.cookie) args.push('--cookie', String(params.cookie));
      if (params.dbms) args.push('--dbms', String(params.dbms));
      if (params.dump === true) args.push('--dump');

      return args;
    },
    formatResult: (result, params, startedAt) => {
      const url = String(params.url ?? params.target ?? '');
      const parsed = parseSqlmapSummary(result.stdout, result.stderr);
      return {
        tool: 'sqlmap',
        url,
        level: clampInt(params.level, 1, 1, 5),
        risk: clampInt(params.risk, 1, 1, 3),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        ...parsed,
      };
    },
  });

  tool.needsConfirmation = (params) => {
    if (params.dump === true) return true;
    if (clampInt(params.risk, 1, 1, 3) >= 3) return true;
    return false;
  };

  return tool;
}

export function createWpscanTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'WordPress site URL' },
        target: { type: 'string', description: 'URL alias' },
        enumerate: { type: 'string', description: 'Comma-separated: p,t,u,tt,cb,dbe' },
        apiToken: { type: 'string', description: 'WPVulnDB API token' },
        stealthy: { type: 'boolean', description: 'Random user-agent and delays' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const url = normalizeScanUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;

      const enumerate = String(params.enumerate ?? 'p,t,u').trim() || 'p,t,u';
      const args = ['--url', url, '-e', enumerate, '-f', 'json', '--disable-tls-checks'];
      if (params.apiToken) args.push('--api-token', String(params.apiToken));
      if (params.stealthy === true) {
        args.push('--stealthy', '--random-user-agent');
      }
      return args;
    },
    formatResult: (result, params, startedAt) => {
      const url = String(params.url ?? params.target ?? '');
      let report: unknown = result.stdout.trim();
      try {
        if (result.stdout.trim()) report = JSON.parse(result.stdout);
      } catch {
        report = { raw: result.stdout.trim() };
      }
      return {
        tool: 'wpscan',
        url,
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        report,
        stderr: result.stderr.trim() || undefined,
      };
    },
  });
}

export function createWhatwebTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 120_000,
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        target: { type: 'string', description: 'URL alias' },
        aggression: { type: 'number', description: 'Stealth 1 to aggressive 4' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
    },
    buildArgs: (params) => {
      const url = normalizeScanUrl(params.url ?? params.target);
      if (typeof url !== 'string') return url;
      const aggression = clampInt(params.aggression, 3, 1, 4);
      return ['-a', String(aggression), '--log-json=-', url];
    },
    formatResult: (result, params, startedAt) => {
      const url = String(params.url ?? params.target ?? '');
      let technologies: unknown = result.stdout.trim();
      try {
        if (result.stdout.trim()) technologies = JSON.parse(result.stdout);
      } catch {
        technologies = { raw: result.stdout.trim() };
      }
      return {
        tool: 'whatweb',
        url,
        aggression: clampInt(params.aggression, 3, 1, 4),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        technologies,
        stderr: result.stderr.trim() || undefined,
      };
    },
  });
}

const YERSINIA_PROTOCOLS = new Set(['stp', 'cdp', 'dtp', 'dhcp', 'hsrp', 'vtp', 'dot1x']);

export function createYersiniaTool(def: CyberToolDef) {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 120_000,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'Network interface (e.g. eth0)' },
        target: { type: 'string', description: 'Interface alias' },
        protocol: { type: 'string', description: 'Protocol or comma-separated list, or all' },
        mode: { type: 'string', enum: ['attack', 'discover'], description: 'Operation mode' },
      },
      required: [],
    },
    buildArgs: (params) => {
      const iface = sanitizeInterface(params.interface ?? params.target);
      if (typeof iface !== 'string') return { error: 'interface is required' };

      const mode = String(params.mode ?? 'discover');
      const protocolRaw = String(params.protocol ?? 'all').toLowerCase();
      const protocols = protocolRaw.split(',').map((item) => item.trim()).filter(Boolean);

      if (mode === 'discover') {
        return ['-I', iface, '-V'];
      }

      const proto = protocols.includes('all') ? 'stp' : protocols[0];
      if (!proto || !YERSINIA_PROTOCOLS.has(proto)) {
        return { error: `unsupported protocol: ${proto ?? 'none'}` };
      }
      return [proto, '-attack', '1', '-interface', iface];
    },
    formatResult: (result, params, startedAt) => ({
      tool: 'yersinia',
      interface: String(params.interface ?? params.target ?? ''),
      protocol: String(params.protocol ?? 'all'),
      mode: String(params.mode ?? 'discover'),
      duration: (Date.now() - startedAt) / 1000,
      exitCode: result.exitCode,
      output: [result.stdout, result.stderr].filter(Boolean).join('\n').trim(),
      note: String(params.mode ?? 'discover') === 'attack'
        ? 'Layer 2 attacks may disrupt network connectivity. Use only on authorized segments.'
        : undefined,
    }),
  });

  tool.needsConfirmation = (params) => String(params.mode ?? 'discover') === 'attack';
  return tool;
}

export function createLegionTool(def: CyberToolDef) {
  return createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'IP or CIDR range' },
        ports: { type: 'string', enum: ['top1000', 'all', 'custom'], description: 'Port range profile' },
        brute: { type: 'boolean', description: 'Enable brute forcing' },
        screenshots: { type: 'boolean', description: 'Capture web service screenshots' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['target'],
    },
    buildArgs: (params) => {
      const target = sanitizeTarget(params.target);
      if (typeof target !== 'string') return target;

      const ports = String(params.ports ?? 'top1000');
      const args = ['--target', target, '--ports', ports, '--headless', '--json', '/dev/stdout'];
      if (params.brute === true) args.push('--brute');
      if (params.screenshots !== false) args.push('--screenshots');
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
        tool: 'legion',
        target: String(params.target ?? ''),
        ports: String(params.ports ?? 'top1000'),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        report,
        stderr: result.stderr.trim() || undefined,
        note: result.exitCode !== 0
          ? 'Legion headless mode may require GUI dependencies or a local display. Verify legion is installed.'
          : undefined,
      };
    },
  });
}
