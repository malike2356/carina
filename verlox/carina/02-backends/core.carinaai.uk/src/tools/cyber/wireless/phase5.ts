import type { Tool } from '../../../types/index.js';
import type { CyberToolDef } from '../../cyber-tools-registry.js';
import { createReconTool } from '../factory.js';
import {
  clampInt,
  sanitizeBssid,
  sanitizeEttercapTarget,
  sanitizeInterface,
  sanitizePath,
  sanitizeTarget,
} from '../sanitize.js';

const DEFAULT_WORDLIST = '/usr/share/wordlists/rockyou.txt';
const DEFAULT_CAPTURE_DIR = '/tmp/carina-capture';

const BETTERCAP_ATTACK_MODULES = new Set([
  'arp.spoof',
  'dns.spoof',
  'http.proxy',
  'https.proxy',
  'wifi.recon',
  'wifi.deauth',
  'ble.recon',
  'hid.recon',
]);

const ETTERCAP_MITM = new Set(['arp:remote', 'arp', 'icmp', 'dhcp', 'port']);

function parseModuleList(raw: unknown, fallback: string[]): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

async function kismetFetch(
  path: string,
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const apiBase = (process.env.KISMET_URL ?? 'http://127.0.0.1:2501').replace(/\/$/, '');
  const apiKey = process.env.KISMET_API_KEY ?? process.env.KISMET_TOKEN ?? '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const response = await fetch(`${apiBase}${path}`, { headers });
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
        error: `Kismet API ${response.status}: ${text.slice(0, 500)}`,
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

export function parseAircrackOutput(text: string): {
  keyFound: boolean;
  key?: string;
  bssid?: string;
} {
  const keyMatch = text.match(/KEY FOUND!\s*\[\s*([^\]]+)\]/i);
  const bssidMatch = text.match(/BSSID:\s*([0-9a-f:]{17})/i);
  return {
    keyFound: /KEY FOUND!/i.test(text),
    key: keyMatch?.[1]?.trim(),
    bssid: bssidMatch?.[1]?.toLowerCase(),
  };
}

export function parseWifiteOutput(text: string): {
  cracked: string[];
  handshakes: string[];
  wpsPins: string[];
} {
  const cracked: string[] = [];
  const handshakes: string[] = [];
  const wpsPins: string[] = [];
  for (const line of text.split('\n')) {
    const crackHit = line.match(/cracked\s+(.+)/i);
    if (crackHit) cracked.push(crackHit[1]?.trim() ?? '');
    const ssidHit = line.match(/ESSID:\s*(.+)/i);
    if (ssidHit) handshakes.push(ssidHit[1]?.trim() ?? '');
    const pinHit = line.match(/WPS PIN:\s*(\S+)/i);
    if (pinHit) wpsPins.push(pinHit[1] ?? '');
  }
  return { cracked, handshakes, wpsPins };
}

export function parseBettercapEvents(text: string): {
  credentials: Array<{ user?: string; pass?: string; host?: string }>;
  events: number;
} {
  const credentials: Array<{ user?: string; pass?: string; host?: string }> = [];
  let events = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    events += 1;
    const cred = line.match(/(?:password|pass|credential)[^\n]*user[=:\s]+(\S+)[^\n]*pass[=:\s]+(\S+)/i);
    if (cred) {
      credentials.push({ user: cred[1], pass: cred[2] });
    }
  }
  return { credentials, events };
}

export function parseKismetDevices(body: unknown): Array<{
  mac: string;
  name?: string;
  signal?: number;
  channel?: string;
  type?: string;
}> {
  if (!Array.isArray(body)) return [];
  return body.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      mac: String(item['kismet.device.base.macaddr'] ?? item.macaddr ?? ''),
      name: item['kismet.device.base.name'] != null
        ? String(item['kismet.device.base.name'])
        : undefined,
      signal: typeof item['kismet.device.base.signal'] === 'number'
        ? item['kismet.device.base.signal']
        : undefined,
      channel: item['kismet.device.base.channel'] != null
        ? String(item['kismet.device.base.channel'])
        : undefined,
      type: item['kismet.device.base.type'] != null
        ? String(item['kismet.device.base.type'])
        : undefined,
    };
  }).filter((row) => row.mac);
}

function resolveAircrackBinary(mode: string): string {
  if (mode === 'deauth') return 'aireplay-ng';
  if (mode === 'capture' || mode === 'scan') return 'airodump-ng';
  return 'aircrack-ng';
}

function buildAircrackArgs(params: Record<string, unknown>): string[] | { error: string } {
  const iface = sanitizeInterface(params.interface ?? params.iface);
  if (typeof iface !== 'string') return iface;

  const mode = String(params.mode ?? params.action ?? 'capture').toLowerCase();
  const timeoutSec = clampInt(params.timeout, 300, 10, 7200);

  if (mode === 'capture' || mode === 'scan') {
    const prefix = params.output
      ? sanitizePath(params.output)
      : `${DEFAULT_CAPTURE_DIR}_${Date.now()}`;
    if (typeof prefix !== 'string') return prefix;

    const args = [iface, '-w', prefix, '--output-format', 'pcap'];
    const channel = params.channel != null ? clampInt(params.channel, 0, 1, 196) : 0;
    if (channel > 0) args.push('-c', String(channel));

    const bssidRaw = params.bssid ?? params.target;
    if (bssidRaw) {
      const bssid = sanitizeBssid(bssidRaw);
      if (typeof bssid !== 'string') return bssid;
      args.push('--bssid', bssid);
    }

    args.push('--write-interval', '5');
    void timeoutSec;
    return args;
  }

  if (mode === 'deauth') {
    const bssidRaw = params.bssid ?? params.target;
    if (!bssidRaw) return { error: 'bssid or target is required for deauth mode' };
    const bssid = sanitizeBssid(bssidRaw);
    if (typeof bssid !== 'string') return bssid;
    const count = clampInt(params.count, 10, 1, 100);
    return ['--deauth', String(count), '-a', bssid, iface];
  }

  if (mode === 'crack' || mode === 'wep' || mode === 'wpa' || mode === 'wpa2') {
    const capRaw = params.capFile ?? params.capture;
    if (!capRaw) return { error: 'capFile is required for crack mode' };
    const capFile = sanitizePath(String(capRaw));
    if (typeof capFile !== 'string') return capFile;

    const wordlistRaw = params.wordlist ?? DEFAULT_WORDLIST;
    const wordlist = sanitizePath(String(wordlistRaw));
    if (typeof wordlist !== 'string') return wordlist;

    const args = [capFile, '-w', wordlist];
    const bssidRaw = params.bssid ?? params.target;
    if (bssidRaw) {
      const bssid = sanitizeBssid(bssidRaw);
      if (typeof bssid !== 'string') return bssid;
      args.push('-b', bssid);
    }
    return args;
  }

  return { error: `unsupported aircrack mode: ${mode}` };
}

export function createAircrackTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'Monitor-mode WiFi interface (e.g. wlan0mon)' },
        mode: {
          type: 'string',
          enum: ['capture', 'scan', 'crack', 'wep', 'wpa', 'wpa2', 'deauth'],
          description: 'Audit mode',
        },
        bssid: { type: 'string', description: 'Target BSSID' },
        target: { type: 'string', description: 'BSSID alias' },
        channel: { type: 'number', description: 'WiFi channel' },
        wordlist: { type: 'string', description: 'Wordlist for WPA cracking' },
        capFile: { type: 'string', description: 'Capture file for cracking' },
        capture: { type: 'string', description: 'Capture file alias' },
        output: { type: 'string', description: 'Capture output prefix' },
        count: { type: 'number', description: 'Deauth packet count' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['interface'],
    },
    buildArgs: (params) => buildAircrackArgs(params),
    resolveBinary: (params) => resolveAircrackBinary(String(params.mode ?? params.action ?? 'capture')),
    formatResult: (result, params, startedAt) => {
      const mode = String(params.mode ?? params.action ?? 'capture');
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      const body: Record<string, unknown> = {
        tool: 'aircrack-ng',
        mode,
        interface: String(params.interface ?? ''),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        output,
      };
      if (mode === 'crack' || mode.startsWith('wpa') || mode === 'wep') {
        body.cracked = parseAircrackOutput(output);
      }
      return body;
    },
  });

  tool.needsConfirmation = (params) => {
    const mode = String(params.mode ?? params.action ?? 'capture').toLowerCase();
    return mode === 'deauth' || mode === 'crack' || mode === 'wep' || mode.startsWith('wpa');
  };

  return tool;
}

function buildBettercapEval(params: Record<string, unknown>): string | { error: string } {
  const parts: string[] = [];
  const target = params.target ? sanitizeTarget(params.target) : null;
  if (target && typeof target !== 'string') return target;

  const gateway = params.gateway ? sanitizeTarget(params.gateway) : null;
  if (gateway && typeof gateway !== 'string') return gateway;

  if (target) parts.push(`set arp.spoof.targets ${target};`);
  if (gateway) {
    parts.push(`set arp.spoof.fullduplex true;`);
    parts.push(`set net.sniff.local false;`);
  }

  const sniffFilter = params.sniffFilter ?? params.filter;
  if (typeof sniffFilter === 'string' && sniffFilter.trim()) {
    const safe = sniffFilter.replace(/['";]/g, '');
    parts.push(`set net.sniff.filter '${safe}';`);
  }

  const modules = parseModuleList(params.modules ?? params.module, ['arp.spoof', 'net.sniff']);
  for (const mod of modules) {
    if (!/^[a-z0-9._-]+$/i.test(mod)) {
      return { error: `invalid bettercap module: ${mod}` };
    }
    parts.push(`${mod} on;`);
  }

  if (params.caplet) {
    const caplet = sanitizePath(params.caplet);
    if (typeof caplet !== 'string') return caplet;
    parts.push(`include ${caplet};`);
  }

  parts.push('events.stream on;');
  return parts.join(' ');
}

export function createBettercapTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'Network interface' },
        target: { type: 'string', description: 'Target IP or CIDR' },
        gateway: { type: 'string', description: 'Gateway IP' },
        modules: { type: 'array', description: 'Bettercap modules to enable' },
        module: { type: 'string', description: 'Single module alias' },
        caplet: { type: 'string', description: 'Caplet script path' },
        sniffFilter: { type: 'string', description: 'BPF sniff filter' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['interface'],
    },
    buildArgs: (params) => {
      const iface = sanitizeInterface(params.interface ?? params.iface);
      if (typeof iface !== 'string') return iface;

      const evalScript = buildBettercapEval(params);
      if (typeof evalScript !== 'string') return evalScript;

      return ['-iface', iface, '-eval', evalScript, '-no-colors', '-silent'];
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      const parsed = parseBettercapEvents(output);
      return {
        tool: 'bettercap',
        interface: String(params.interface ?? ''),
        modules: parseModuleList(params.modules ?? params.module, ['arp.spoof', 'net.sniff']),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        ...parsed,
        output,
      };
    },
  });

  tool.needsConfirmation = (params) => {
    const modules = parseModuleList(params.modules ?? params.module, ['arp.spoof', 'net.sniff']);
    return modules.some((mod) => BETTERCAP_ATTACK_MODULES.has(mod));
  };

  return tool;
}

export function createKismetTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: false,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'WiFi interface for passive discovery' },
        source: { type: 'string', description: 'Kismet source spec (e.g. wlan0=wlan0)' },
        duration: { type: 'number', description: 'Suggested scan duration in seconds' },
        action: { type: 'string', enum: ['discover', 'devices'], description: 'Kismet action' },
      },
      required: ['interface'],
    },
    execute: async (params) => {
      const iface = sanitizeInterface(params.interface ?? params.iface);
      if (typeof iface !== 'string') return iface;

      const source = params.source
        ? String(params.source).trim()
        : `${iface}=${iface}`;

      const devices = await kismetFetch('/devices/views/all/devices.json');
      if (!devices.ok) {
        return {
          tool: 'kismet',
          interface: iface,
          source,
          error: devices.error,
          note: 'Start Kismet first: kismet -c ' + source + ' --no-gps. Set KISMET_URL if not on port 2501.',
        };
      }

      const parsed = parseKismetDevices(devices.body);
      return {
        tool: 'kismet',
        interface: iface,
        source,
        deviceCount: parsed.length,
        devices: parsed,
        duration: clampInt(params.duration, 60, 5, 3600),
      };
    },
  };
}

export function createWifiteTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 600_000,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'WiFi interface' },
        wps: { type: 'boolean', description: 'Enable WPS PIN attacks' },
        wpa: { type: 'boolean', description: 'Capture WPA handshakes' },
        crack: { type: 'boolean', description: 'Crack captured handshakes' },
        kill: { type: 'boolean', description: 'Kill conflicting processes' },
        wordlist: { type: 'string', description: 'Dictionary path' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['interface'],
    },
    buildArgs: (params) => {
      const iface = sanitizeInterface(params.interface ?? params.iface);
      if (typeof iface !== 'string') return iface;

      const args = ['-i', iface, '-p', '30'];
      args.push(params.wps === false ? '--no-wps' : '--wps');
      args.push(params.wpa === false ? '--no-wpa' : '--wpa');
      args.push(params.crack === false ? '--no-crack' : '--crack');
      if (params.kill === true) args.push('-kill');

      const dict = params.wordlist ?? params.dict ?? DEFAULT_WORDLIST;
      const wordlist = sanitizePath(String(dict));
      if (typeof wordlist !== 'string') return wordlist;
      args.push('--dict', wordlist);

      return args;
    },
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      return {
        tool: 'wifite',
        interface: String(params.interface ?? ''),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        ...parseWifiteOutput(output),
        output,
      };
    },
  });

  tool.needsConfirmation = () => true;

  return tool;
}

function buildEttercapArgs(params: Record<string, unknown>): string[] | { error: string } {
  const iface = sanitizeInterface(params.interface ?? params.iface);
  if (typeof iface !== 'string') return iface;

  const args = ['-T', '-i', iface];

  const mitm = String(params.mitm ?? 'arp:remote');
  if (!ETTERCAP_MITM.has(mitm)) {
    return { error: `unsupported ettercap mitm mode: ${mitm}` };
  }

  const target1Raw = params.target1 ?? params.target;
  const target2Raw = params.target2 ?? params.gateway;

  if (target1Raw && target2Raw) {
    const target1 = sanitizeEttercapTarget(target1Raw);
    if (typeof target1 !== 'string') return target1;
    const target2 = sanitizeEttercapTarget(target2Raw);
    if (typeof target2 !== 'string') return target2;
    args.push('-M', mitm, target1, target2);
  }

  if (params.sniff !== false) args.push('-q');
  args.push('-P', 'autoadd');

  if (params.filter) {
    const filterPath = sanitizePath(params.filter);
    if (typeof filterPath !== 'string') return filterPath;
    args.push('-F', filterPath);
  }

  const pcapRaw = params.pcap ?? params.output;
  const pcap = pcapRaw
    ? sanitizePath(String(pcapRaw))
    : sanitizePath(`/tmp/ettercap_${Date.now()}.pcap`);
  if (typeof pcap !== 'string') return pcap;
  args.push('-w', pcap);

  return args;
}

export function createEttercapTool(def: CyberToolDef): Tool {
  const tool = createReconTool({
    def,
    defaultTimeoutMs: 300_000,
    parameters: {
      type: 'object',
      properties: {
        interface: { type: 'string', description: 'Network interface' },
        target: { type: 'string', description: 'Victim IP (target1 alias)' },
        target1: { type: 'string', description: 'MITM target 1 (/IP/ format)' },
        target2: { type: 'string', description: 'MITM target 2 (/IP/ format)' },
        gateway: { type: 'string', description: 'Gateway IP (target2 alias)' },
        mitm: { type: 'string', enum: ['arp:remote', 'arp', 'icmp', 'dhcp', 'port'], description: 'MITM mode' },
        sniff: { type: 'boolean', description: 'Quiet sniff mode' },
        filter: { type: 'string', description: 'Ettercap filter (.ef) path' },
        pcap: { type: 'string', description: 'PCAP output path' },
        timeout: { type: 'number', description: 'Max seconds' },
      },
      required: ['interface'],
    },
    buildArgs: (params) => buildEttercapArgs(params),
    formatResult: (result, params, startedAt) => {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
      return {
        tool: 'ettercap',
        interface: String(params.interface ?? ''),
        mitm: String(params.mitm ?? 'arp:remote'),
        duration: (Date.now() - startedAt) / 1000,
        exitCode: result.exitCode,
        output,
      };
    },
  });

  tool.needsConfirmation = (params) => {
    const hasTargets = Boolean(
      (params.target1 ?? params.target) && (params.target2 ?? params.gateway),
    );
    return hasTargets;
  };

  return tool;
}
