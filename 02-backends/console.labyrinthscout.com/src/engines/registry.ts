import { runHarvesterScan } from './harvester-engine.js';
import { runNmapScan } from './nmap-engine.js';
import { runNucleiScan } from './nuclei-engine.js';
import { runSubdomainScan } from './subdomain-engine.js';
import { runTechFingerprint } from './tech-engine.js';
import { runSherlockScan } from './sherlock-engine.js';
import { runSpiderfootScan } from './spiderfoot-engine.js';
import { runNiktoScan } from './nikto-engine.js';
import { runWpscanScan } from './wpscan-engine.js';
import {
  runArjunScan,
  runDirsearchScan,
  runFeroxbusterScan,
  runFfufScan,
  runGobusterScan,
  runVhostScan,
} from './web-fuzz-engine.js';
import { runSnortScan } from './snort-engine.js';
import { runBloodhoundScan } from './bloodhound-engine.js';
import { runLog2timelineScan, runTimesketchScan, runYaraScan } from './forensics-engine.js';
import { runCyberchefScan, runStixExport } from './reporting-engine.js';
import { runQuickScan } from './quick-scan.js';
import { resolveDomain } from './domain.js';
import type { ScanContext } from './scan-context.js';
import type { EngineFinding } from './types.js';
import type { TargetType } from '../findings/types.js';

export type ScanSchedule = 'daily' | 'weekly' | 'monthly' | 'continuous' | 'on-demand';
export type ScoutToolTier = 'monitor' | 'govern' | 'enterprise';

export interface EngineDefinition {
  name: string;
  schedule: ScanSchedule;
  tier: ScoutToolTier;
  domainOnly?: boolean;
}

export interface EngineRunContext extends ScanContext {
  accountId: string;
  targetId: string;
}

export type EngineRunner = (ctx: EngineRunContext) => Promise<{ findings: EngineFinding[]; engine: string }>;

export const ENGINE_REGISTRY: Record<string, EngineDefinition> = {
  nmap: { name: 'nmap', schedule: 'weekly', tier: 'monitor' },
  amass: { name: 'amass', schedule: 'daily', tier: 'monitor' },
  theHarvester: { name: 'theHarvester', schedule: 'weekly', tier: 'monitor', domainOnly: true },
  spiderfoot: { name: 'spiderfoot', schedule: 'weekly', tier: 'govern', domainOnly: true },
  sherlock: { name: 'sherlock', schedule: 'monthly', tier: 'govern', domainOnly: true },
  nuclei: { name: 'nuclei', schedule: 'daily', tier: 'monitor' },
  nikto: { name: 'nikto', schedule: 'weekly', tier: 'monitor' },
  wpscan: { name: 'wpscan', schedule: 'weekly', tier: 'monitor' },
  whatweb: { name: 'whatweb', schedule: 'weekly', tier: 'monitor' },
  arjun: { name: 'arjun', schedule: 'monthly', tier: 'govern' },
  dirsearch: { name: 'dirsearch', schedule: 'monthly', tier: 'monitor' },
  feroxbuster: { name: 'feroxbuster', schedule: 'monthly', tier: 'govern' },
  gobuster: { name: 'gobuster', schedule: 'monthly', tier: 'monitor' },
  ffuf: { name: 'ffuf', schedule: 'monthly', tier: 'govern' },
  snort: { name: 'snort', schedule: 'continuous', tier: 'govern' },
  bloodhound: { name: 'bloodhound', schedule: 'monthly', tier: 'govern', domainOnly: true },
  log2timeline: { name: 'log2timeline', schedule: 'on-demand', tier: 'govern' },
  timesketch: { name: 'timesketch', schedule: 'on-demand', tier: 'govern' },
  yara: { name: 'yara', schedule: 'weekly', tier: 'govern' },
  stix: { name: 'stix', schedule: 'on-demand', tier: 'monitor' },
  cyberchef: { name: 'cyberchef', schedule: 'on-demand', tier: 'monitor' },
  'quick-scan': { name: 'quick-scan', schedule: 'on-demand', tier: 'monitor' },
  'free-scan': { name: 'free-scan', schedule: 'on-demand', tier: 'monitor' },
};

export const SCOUT_ENGINE_NAMES = Object.keys(ENGINE_REGISTRY);

export function isKnownEngine(tool: string): boolean {
  return tool in ENGINE_REGISTRY;
}

export function scheduleIntervalMs(schedule: ScanSchedule): number | null {
  switch (schedule) {
    case 'daily': return 24 * 60 * 60 * 1000;
    case 'weekly': return 7 * 24 * 60 * 60 * 1000;
    case 'monthly': return 30 * 24 * 60 * 60 * 1000;
    case 'continuous': return 60 * 60 * 1000;
    case 'on-demand': return null;
    default: return null;
  }
}

async function buildContext(
  domain: string,
  targetType: TargetType,
  accountId: string,
  targetId: string,
  config?: Record<string, unknown>,
): Promise<EngineRunContext> {
  const host = (await resolveDomain(domain)) ?? domain;
  return { domain, host, targetType, accountId, targetId, config };
}

export async function runEngine(
  tool: string,
  domain: string,
  targetType: TargetType,
  accountId: string,
  targetId: string,
  config?: Record<string, unknown>,
): Promise<{ findings: EngineFinding[]; engine: string }> {
  const ctx = await buildContext(domain, targetType, accountId, targetId, config);
  const def = ENGINE_REGISTRY[tool];
  if (def?.domainOnly && targetType !== 'domain') {
    return { findings: [], engine: `${tool}:skipped` };
  }

  if (tool === 'quick-scan' || tool === 'free-scan') {
    const result = await runQuickScan(domain);
    return { findings: result.findings, engine: 'quick-scan' };
  }
  if (tool === 'nmap') {
    const result = await runNmapScan(ctx.host, domain);
    return { findings: result.findings, engine: result.engine };
  }
  if (tool === 'nuclei') {
    const result = await runNucleiScan(domain);
    return { findings: result.findings, engine: result.engine };
  }
  if (tool === 'amass') {
    const result = await runSubdomainScan(domain);
    return { findings: result.findings, engine: result.engine };
  }
  if (tool === 'whatweb') {
    const result = await runTechFingerprint(domain);
    return { findings: result.findings, engine: result.engine };
  }
  if (tool === 'theHarvester') return runHarvesterScan(ctx);
  if (tool === 'sherlock') return runSherlockScan(ctx);
  if (tool === 'spiderfoot') return runSpiderfootScan(ctx);
  if (tool === 'nikto') return runNiktoScan(ctx);
  if (tool === 'wpscan') return runWpscanScan(ctx);
  if (tool === 'arjun') return runArjunScan(ctx);
  if (tool === 'dirsearch') return runDirsearchScan(ctx);
  if (tool === 'feroxbuster') return runFeroxbusterScan(ctx);
  if (tool === 'gobuster') {
    const dir = await runGobusterScan(ctx);
    const vhost = await runVhostScan(ctx);
    return {
      findings: [...dir.findings, ...vhost.findings].slice(0, 50),
      engine: dir.engine,
    };
  }
  if (tool === 'ffuf') return runFfufScan(ctx);
  if (tool === 'snort') return runSnortScan(ctx);
  if (tool === 'bloodhound') return runBloodhoundScan(ctx);
  if (tool === 'log2timeline') return runLog2timelineScan(ctx);
  if (tool === 'timesketch') return runTimesketchScan(ctx);
  if (tool === 'yara') return runYaraScan(ctx);
  if (tool === 'stix') return runStixExport(ctx);
  if (tool === 'cyberchef') return runCyberchefScan(ctx);

  const fallback = await runQuickScan(domain);
  return { findings: fallback.findings, engine: 'quick-scan:fallback' };
}

export function defaultEnginesForTier(tier: ScoutToolTier): string[] {
  return Object.entries(ENGINE_REGISTRY)
    .filter(([, def]) => {
      if (def.schedule === 'on-demand') return false;
      if (tier === 'monitor') return def.tier === 'monitor';
      if (tier === 'govern') return def.tier === 'monitor' || def.tier === 'govern';
      return true;
    })
    .map(([name]) => name);
}
