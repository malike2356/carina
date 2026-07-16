import path from 'node:path';
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { runCapa } from './capa_runner.js';
import { runCapev2 } from './capev2_client.js';
import { runDrakvuf } from './drakvuf_runner.js';
import { runFloss } from './floss_runner.js';
import { runGhidraHeadless } from './ghidra_headless.js';
import { runMobsf } from './mobsf_client.js';
import { runRadare2 } from './radare2_runner.js';
import { commandExists } from './run.js';
import { runVolatility } from './volatility_runner.js';
import { runX64dbg } from './x64dbg_runner.js';
import { runYara } from './yara_runner.js';

const BINARY_TOOLS = [
  'yara',
  'capa',
  'volatility',
  'radare2',
  'floss',
  'drakvuf',
  'x64dbg',
] as const;

export async function probeArsenalAvailabilityAsync(): Promise<Record<string, boolean>> {
  const cfg = loadWardenConfig();
  const availability: Record<string, boolean> = {};

  for (const name of BINARY_TOOLS) {
    const tool = cfg.arsenal[name];
    availability[name] = Boolean(tool?.enabled && commandExists(tool.binary || name));
  }
  availability.ghidra = Boolean(
    cfg.arsenal.ghidra?.enabled &&
    commandExists(cfg.arsenal.ghidra.analyze_headless || 'analyzeHeadless'),
  );
  availability.capev2 = Boolean(
    cfg.arsenal.capev2?.enabled && cfg.arsenal.capev2.base_url,
  );
  availability.mobsf = Boolean(cfg.arsenal.mobsf?.enabled && cfg.arsenal.mobsf.base_url);
  return availability;
}

export async function runArsenalPipeline(targetPath: string): Promise<ArsenalResult[]> {
  const extension = path.extname(targetPath).toLowerCase();
  const runs: Array<Promise<ArsenalResult>> = [
    runYara(targetPath),
    runCapa(targetPath),
    runRadare2(targetPath),
    runFloss(targetPath),
    runGhidraHeadless(targetPath),
    runCapev2(targetPath),
    runDrakvuf(targetPath),
    runX64dbg(targetPath),
  ];

  if (extension === '.apk' || extension === '.ipa' || extension === '.aab') {
    runs.push(runMobsf(targetPath));
  }
  if (['.dmp', '.dump', '.mem', '.raw'].includes(extension)) {
    runs.push(runVolatility(targetPath));
  }

  return Promise.all(runs);
}
