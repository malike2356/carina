import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadWardenConfig } from '../config.js';
import type { ArsenalResult } from '../types.js';
import { commandExists, runCommand } from './run.js';

export async function runGhidraHeadless(targetPath: string): Promise<ArsenalResult> {
  const started = Date.now();
  const cfg = loadWardenConfig();
  const binary = cfg.arsenal.ghidra?.analyze_headless || 'analyzeHeadless';
  const available = Boolean(cfg.arsenal.ghidra?.enabled) && commandExists(binary);
  if (!available) {
    return {
      tool: 'ghidra',
      ok: false,
      available: false,
      summary: 'Ghidra headless analyzer not available',
      findings: {},
      durationMs: Date.now() - started,
    };
  }
  if (!fs.existsSync(targetPath)) {
    return {
      tool: 'ghidra',
      ok: false,
      available: true,
      summary: 'Analysis target not found',
      findings: { targetPath },
      durationMs: Date.now() - started,
    };
  }

  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warden-ghidra-'));
  try {
    const result = await runCommand(
      binary,
      [projectDir, 'WardenAnalysis', '-import', targetPath, '-deleteProject'],
      { timeoutMs: 300_000 },
    );
    return {
      tool: 'ghidra',
      ok: result.code === 0,
      available: true,
      summary: result.code === 0 ? 'Ghidra analysis completed' : 'Ghidra analysis failed',
      findings: {
        targetPath,
        output: result.stdout.slice(0, 20_000),
        errors: result.stderr.slice(0, 10_000),
      },
      raw: result.stdout.slice(0, 50_000),
      durationMs: Date.now() - started,
    };
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}
