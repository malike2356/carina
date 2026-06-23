import type { Tool } from '../../types/index.js';
import { CYBER_TOOLS, getCyberToolDef, type CyberToolDef } from '../cyber-tools-registry.js';
import { buildUpgradeBanner, resolveWorkspaceTier } from '../tier-check.js';
import { runBinary, type BinaryRunResult } from './exec.js';
import { sanitizeTarget } from './sanitize.js';
import { createNmapTool } from './recon/nmap.js';
import {
  createAmassTool,
  createTheHarvesterTool,
  createReconNgTool,
  createSpiderfootTool,
  createSherlockTool,
  createMaltegoTool,
  createDmitryTool,
  createMetagoofilTool,
  createCewlTool,
} from './recon/phase1.js';
import {
  createNucleiTool,
  createNiktoTool,
  createSqlmapTool,
  createWpscanTool,
  createWhatwebTool,
  createYersiniaTool,
  createLegionTool,
} from './vuln/phase2.js';
import {
  createMetasploitTool,
  createImpacketTool,
  createHydraTool,
  createJohnTool,
  createHashcatTool,
  createEvilWinrmTool,
  createCrackmapexecTool,
  createMimikatzTool,
} from './exploit/phase3.js';
import {
  createBurpTool,
  createFfufTool,
  createDirsearchTool,
  createFeroxbusterTool,
  createGobusterTool,
  createArjunTool,
  createSstimapTool,
} from './web/phase4.js';
import {
  createAircrackTool,
  createBettercapTool,
  createKismetTool,
  createWifiteTool,
  createEttercapTool,
} from './wireless/phase5.js';
import {
  createAutopsyTool,
  createVolatilityTool,
  createDc3ddTool,
  createSleuthkitTool,
  createBinwalkTool,
  createGhidraTool,
  createBulkExtractorTool,
  createYaraTool,
  createGuymagerTool,
  createRekallTool,
  createForemostTool,
  createPlasmoTool,
  createXplicoTool,
  createRegripperTool,
  createHashdeepTool,
  createOllydbgTool,
} from './forensic/phase6.js';
import {
  createTsharkTool,
  createTcpdumpTool,
  createDsniffTool,
  createResponderTool,
  createScapyTool,
} from './traffic/phase7.js';
import {
  createAnonsurfTool,
  createTorTool,
  createMat2Tool,
  createBleachbitTool,
  createGpartedTool,
} from './privacy/phase8.js';
import {
  createRadare2Tool,
  createCutterTool,
  createVscodiumTool,
} from './reverse/phase9.js';
import {
  createSnortTool,
  createBloodhoundTool,
} from './blue/phase10.js';
import {
  createLog2timelineTool,
  createTimesketchTool,
  createStixTool,
  createCyberchefTool,
  resolveTimelineEngine,
} from './reporting/phase11.js';

const RECON_TOOL_NAMES = new Set([
  'nmap',
  'amass',
  'theHarvester',
  'recon-ng',
  'spiderfoot',
  'sherlock',
  'maltego',
  'dmitry',
  'metagoofil',
  'cewl',
]);

const RECON_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  nmap: createNmapTool,
  amass: createAmassTool,
  theHarvester: createTheHarvesterTool,
  'recon-ng': createReconNgTool,
  spiderfoot: createSpiderfootTool,
  sherlock: createSherlockTool,
  maltego: createMaltegoTool,
  dmitry: createDmitryTool,
  metagoofil: createMetagoofilTool,
  cewl: createCewlTool,
};

const VULN_TOOL_NAMES = new Set([
  'nuclei',
  'nikto',
  'sqlmap',
  'wpscan',
  'whatweb',
  'yersinia',
  'legion',
]);

const VULN_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  nuclei: createNucleiTool,
  nikto: createNiktoTool,
  sqlmap: createSqlmapTool,
  wpscan: createWpscanTool,
  whatweb: createWhatwebTool,
  yersinia: createYersiniaTool,
  legion: createLegionTool,
};

const EXPLOIT_TOOL_NAMES = new Set([
  'metasploit',
  'impacket',
  'hydra',
  'john',
  'hashcat',
  'evil-winrm',
  'crackmapexec',
  'mimikatz',
]);

const EXPLOIT_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  metasploit: createMetasploitTool,
  impacket: createImpacketTool,
  hydra: createHydraTool,
  john: createJohnTool,
  hashcat: createHashcatTool,
  'evil-winrm': createEvilWinrmTool,
  crackmapexec: createCrackmapexecTool,
  mimikatz: createMimikatzTool,
};

const WEB_TOOL_NAMES = new Set([
  'burpsuite',
  'ffuf',
  'dirsearch',
  'feroxbuster',
  'gobuster',
  'arjun',
  'sstimap',
]);

const WEB_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  burpsuite: createBurpTool,
  ffuf: createFfufTool,
  dirsearch: createDirsearchTool,
  feroxbuster: createFeroxbusterTool,
  gobuster: createGobusterTool,
  arjun: createArjunTool,
  sstimap: createSstimapTool,
};

const WIRELESS_TOOL_NAMES = new Set([
  'aircrack-ng',
  'bettercap',
  'kismet',
  'wifite',
  'ettercap',
]);

const WIRELESS_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  'aircrack-ng': createAircrackTool,
  bettercap: createBettercapTool,
  kismet: createKismetTool,
  wifite: createWifiteTool,
  ettercap: createEttercapTool,
};

const FORENSIC_TOOL_NAMES = new Set([
  'autopsy',
  'volatility3',
  'dc3dd',
  'sleuthkit',
  'binwalk',
  'ghidra',
  'bulk-extractor',
  'yara',
  'guymager',
  'rekall',
  'foremost',
  'plasmo',
  'xplico',
  'regripper',
  'hashdeep',
  'ollydbg',
]);

const FORENSIC_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  autopsy: createAutopsyTool,
  volatility3: createVolatilityTool,
  dc3dd: createDc3ddTool,
  sleuthkit: createSleuthkitTool,
  binwalk: createBinwalkTool,
  ghidra: createGhidraTool,
  'bulk-extractor': createBulkExtractorTool,
  yara: createYaraTool,
  guymager: createGuymagerTool,
  rekall: createRekallTool,
  foremost: createForemostTool,
  plasmo: createPlasmoTool,
  xplico: createXplicoTool,
  regripper: createRegripperTool,
  hashdeep: createHashdeepTool,
  ollydbg: createOllydbgTool,
};

const TRAFFIC_TOOL_NAMES = new Set([
  'tshark',
  'tcpdump',
  'dsniff',
  'responder',
  'scapy',
]);

const TRAFFIC_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  tshark: createTsharkTool,
  tcpdump: createTcpdumpTool,
  dsniff: createDsniffTool,
  responder: createResponderTool,
  scapy: createScapyTool,
};

const PRIVACY_TOOL_NAMES = new Set([
  'anonsurf',
  'tor',
  'mat2',
  'bleachbit',
  'gparted',
]);

const PRIVACY_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  anonsurf: createAnonsurfTool,
  tor: createTorTool,
  mat2: createMat2Tool,
  bleachbit: createBleachbitTool,
  gparted: createGpartedTool,
};

const REVERSE_TOOL_NAMES = new Set([
  'radare2',
  'cutter',
  'vscodium',
]);

const REVERSE_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  radare2: createRadare2Tool,
  cutter: createCutterTool,
  vscodium: createVscodiumTool,
};

const BLUE_TOOL_NAMES = new Set([
  'snort',
  'bloodhound',
]);

const BLUE_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  snort: createSnortTool,
  bloodhound: createBloodhoundTool,
};

const REPORTING_TOOL_NAMES = new Set([
  'log2timeline',
  'timesketch',
  'stix',
  'cyberchef',
]);

const REPORTING_FACTORIES: Record<string, (def: CyberToolDef) => Tool> = {
  log2timeline: createLog2timelineTool,
  timesketch: createTimesketchTool,
  stix: createStixTool,
  cyberchef: createCyberchefTool,
};

function resolveEnhancedFactory(name: string): ((def: CyberToolDef) => Tool) | undefined {
  return RECON_FACTORIES[name]
    ?? VULN_FACTORIES[name]
    ?? EXPLOIT_FACTORIES[name]
    ?? WEB_FACTORIES[name]
    ?? WIRELESS_FACTORIES[name]
    ?? FORENSIC_FACTORIES[name]
    ?? TRAFFIC_FACTORIES[name]
    ?? PRIVACY_FACTORIES[name]
    ?? REVERSE_FACTORIES[name]
    ?? BLUE_FACTORIES[name]
    ?? REPORTING_FACTORIES[name];
}

function isEnhancedCyberTool(name: string): boolean {
  return RECON_TOOL_NAMES.has(name)
    || VULN_TOOL_NAMES.has(name)
    || EXPLOIT_TOOL_NAMES.has(name)
    || WEB_TOOL_NAMES.has(name)
    || WIRELESS_TOOL_NAMES.has(name)
    || FORENSIC_TOOL_NAMES.has(name)
    || TRAFFIC_TOOL_NAMES.has(name)
    || PRIVACY_TOOL_NAMES.has(name)
    || REVERSE_TOOL_NAMES.has(name)
    || BLUE_TOOL_NAMES.has(name)
    || REPORTING_TOOL_NAMES.has(name);
}

async function runBinaryLegacy(
  binary: string,
  args: string[],
): Promise<BinaryRunResult> {
  return runBinary(binary, args, 180_000);
}

export function createCyberTool(def: CyberToolDef): Tool {
  return {
    name: def.name,
    description: def.description,
    dangerous: true,
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Domain, IP, host:port, or URL' },
      },
      required: ['target'],
    },
    execute: async (params) => {
      const parsed = sanitizeTarget(String(params.target ?? ''));
      if (typeof parsed !== 'string') return parsed;

      const args = def.buildArgs?.(parsed) ?? [parsed];
      const result = await runBinaryLegacy(def.binary, args);
      const tier = resolveWorkspaceTier();
      const banner = buildUpgradeBanner(tier);
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

      return {
        tool: def.name,
        target: parsed,
        exitCode: result.exitCode,
        output: banner ? `${output}${banner}` : output,
      };
    },
  };
}

export function createCyberTools(): Tool[] {
  const tools: Tool[] = [];

  for (const def of CYBER_TOOLS) {
    if (isEnhancedCyberTool(def.name)) {
      const factory = resolveEnhancedFactory(def.name);
      if (factory) {
        tools.push(factory(def));
        continue;
      }
    }
    tools.push(createCyberTool(def));
  }

  return tools;
}

export function getCyberTool(name: string): Tool | undefined {
  const def = getCyberToolDef(name);
  if (!def) return undefined;
  if (isEnhancedCyberTool(def.name)) {
    const factory = resolveEnhancedFactory(def.name);
    if (factory) return factory(def);
  }
  return createCyberTool(def);
}
