import fs from 'fs/promises';
import path from 'path';
import { resolveGateMode } from '../skills/eval/gate.js';
import { loadEvalDefinition } from '../skills/eval/fixtures.js';
import { runEval } from '../skills/eval/runner.js';
import { saveReport } from '../skills/eval/report.js';
import type { EvalGateMode, EvalGateResult, EvalSkillOverride } from '../skills/eval/types.js';
import type { ExtensionManifest } from './manifest.js';
import { extensionDir } from '../config/paths.js';

async function loadExtensionEvalSkills(
  bundleDir: string,
  manifest: ExtensionManifest,
): Promise<EvalSkillOverride[]> {
  if (!manifest.capabilities.includes('skills') || !manifest.entryPoints.skills) {
    return [];
  }
  const dir = path.join(bundleDir, manifest.entryPoints.skills);
  const skills: EvalSkillOverride[] = [];
  const entries = await fs.readdir(dir).catch(() => []);
  for (const file of entries) {
    if (!file.endsWith('.json')) continue;
    const parsed = JSON.parse(
      await fs.readFile(path.join(dir, file), 'utf-8'),
    ) as Record<string, unknown> | Record<string, unknown>[];
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      const steps = Array.isArray(item.steps)
        ? item.steps.map(String).join('\n')
        : String(item.steps ?? '');
      const trigger = Array.isArray(item.trigger)
        ? item.trigger.map(String)
        : item.trigger
          ? [String(item.trigger)]
          : [];
      skills.push({
        name: String(item.name ?? ''),
        description: String(item.description ?? ''),
        trigger,
        steps,
        toolsUsed: Array.isArray(item.tools) ? item.tools.map(String) : [],
      });
    }
  }
  return skills.filter((s) => s.name && s.description);
}

export async function runExtensionEvalGate(
  manifest: ExtensionManifest,
  options: { mode?: EvalGateMode; passes?: number } = {},
): Promise<EvalGateResult> {
  const mode = resolveGateMode(options.mode);
  const evalRequired = manifest.eval?.required === true;

  if (mode === 'off' && !evalRequired) {
    return {
      mode: 'off',
      passed: true,
      blocked: false,
      message: 'Extension eval not required',
    };
  }

  if (mode === 'bypass') {
    return {
      mode: 'bypass',
      passed: true,
      blocked: false,
      message: 'Eval gate bypassed',
    };
  }

  const bundleDir = extensionDir(manifest.id);
  const evalRel = manifest.eval?.path ?? 'eval/eval.json';
  const evalPath = path.join(bundleDir, evalRel);

  try {
    await loadEvalDefinition(evalPath);
  } catch {
    if (evalRequired || mode === 'require') {
      return {
        mode,
        passed: false,
        blocked: true,
        message: `Extension "${manifest.id}" requires eval at ${evalRel}`,
      };
    }
    return {
      mode,
      passed: true,
      blocked: false,
      message: `No eval definition for extension "${manifest.id}"; gate skipped`,
    };
  }

  try {
    const skillsOverride = await loadExtensionEvalSkills(bundleDir, manifest);
    const result = await runEval({
      packOrPath: evalPath,
      label: 'extension-gate',
      passes: options.passes ?? 1,
      skillsOverride,
    });
    const report = await saveReport(result);
    const passed = result.thresholdsMet && result.metrics.passRate >= (result.thresholds?.minPassRate ?? 0);

    if (!passed && mode === 'require') {
      return {
        mode,
        passed: false,
        blocked: true,
        message: `Extension eval gate failed for "${manifest.id}": pass rate ${(result.metrics.passRate * 100).toFixed(1)}%`,
        runId: result.runId,
        reportPath: report.runId,
      };
    }

    if (!passed && mode === 'warn') {
      return {
        mode,
        passed: false,
        blocked: false,
        message: `Extension eval warning for "${manifest.id}": pass rate ${(result.metrics.passRate * 100).toFixed(1)}%`,
        runId: result.runId,
        reportPath: report.runId,
      };
    }

    return {
      mode,
      passed: true,
      blocked: false,
      message: `Extension eval gate passed for "${manifest.id}"`,
      runId: result.runId,
      reportPath: report.runId,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (mode === 'require' || evalRequired) {
      return { mode, passed: false, blocked: true, message: `Extension eval gate error: ${msg}` };
    }
    return { mode, passed: false, blocked: false, message: `Extension eval gate warning: ${msg}` };
  }
}
