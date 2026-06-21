import fs from 'fs/promises';
import path from 'path';
import { BUILTIN_PACKS_DIR } from '../../skills/pack-loader.js';
import { runEval } from '../../skills/eval/runner.js';
import { compareEvalDefinitions, blindCompare, compareBaselineCandidate } from '../../skills/eval/comparator.js';
import { saveReport, listRecentReports, loadReport, generateMarkdownReport } from '../../skills/eval/report.js';
import { runPackEvalGate, resolveGateMode } from '../../skills/eval/gate.js';
import { runAuthoringLoop } from '../../skills/eval/authoring-loop.js';
import { buildEvalDefinitionFromPack } from '../../skills/eval/derive-fixtures.js';

function usage(): void {
  console.log(`Usage: carina eval <command> [options]

Commands:
  run <pack|path>       Run eval fixtures (--passes N, --with-llm, --json)
  compare <a> <b>         Compare two eval definitions (--blind, --passes N)
  baseline <pack>         Compare baseline vs candidate skill overrides in eval.json
  generate <pack>         Generate eval fixtures from pack skills (--write)
  gate <pack>             Run publish/install eval gate (--mode warn|require|bypass)
  authoring <pack>        Full authoring loop: fixtures -> benchmark -> review
  reports [limit]         List recent eval reports
  report <run-id>         Show a report by run ID

Options:
  --passes N              Number of statistical passes (default 3 for compare, 1 for run)
  --with-llm              Include optional LLM execution (offline eval only)
  --blind                 Hide labels until grading (compare command)
  --json                  Output JSON
  --mode warn|require|bypass   Eval gate mode
  --write                 Write generated fixtures to pack eval/eval.json
  --bypass-eval           Alias for gate --mode bypass`);
}

function parseFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function parseFlagValue(args: string[], flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

export async function runEvalCommand(args: string[]): Promise<void> {
  const action = args[0];
  if (!action || action === 'help' || action === '-h') {
    usage();
    return;
  }

  if (action === 'run') {
    const target = args[1];
    if (!target) {
      console.error('Usage: carina eval run <pack|path>');
      process.exit(1);
    }
    const passes = Number(parseFlagValue(args, '--passes', '1'));
    const result = await runEval({
      packOrPath: target,
      passes,
      executeWithLlm: parseFlag(args, '--with-llm'),
    });
    const report = await saveReport(result);
    if (parseFlag(args, '--json')) {
      console.log(JSON.stringify({ result, reportId: report.runId }, null, 2));
    } else {
      console.log(generateMarkdownReport(result));
      console.log(`\nReport saved: ${report.runId}`);
    }
    process.exit(result.thresholdsMet ? 0 : 1);
  }

  if (action === 'compare') {
    const pathA = args[1];
    const pathB = args[2];
    if (!pathA || !pathB) {
      console.error('Usage: carina eval compare <eval-a> <eval-b>');
      process.exit(1);
    }
    const passes = Number(parseFlagValue(args, '--passes', '3'));
    if (parseFlag(args, '--blind')) {
      const blind = await blindCompare(pathA, pathB, passes);
      if (parseFlag(args, '--json')) {
        console.log(JSON.stringify(blind, null, 2));
      } else {
        console.log('Blind comparison complete');
        console.log(`Winner: slot ${blind.winner}`);
        console.log(`Revealed A: ${blind.revealed.aLabel}`);
        console.log(`Revealed B: ${blind.revealed.bLabel}`);
        for (const note of blind.notes) console.log(`  ${note}`);
      }
      return;
    }
    const comparison = await compareEvalDefinitions({
      baselinePath: pathA,
      candidatePath: pathB,
      passes,
    });
    await saveReport(comparison.candidate, comparison);
    if (parseFlag(args, '--json')) {
      console.log(JSON.stringify(comparison, null, 2));
    } else {
      console.log(generateMarkdownReport(comparison.candidate, comparison));
    }
    process.exit(comparison.regression ? 1 : 0);
  }

  if (action === 'baseline') {
    const pack = args[1];
    if (!pack) {
      console.error('Usage: carina eval baseline <pack>');
      process.exit(1);
    }
    const passes = Number(parseFlagValue(args, '--passes', '3'));
    const comparison = await compareBaselineCandidate(pack, undefined, undefined, passes);
    await saveReport(comparison.candidate, comparison);
    console.log(generateMarkdownReport(comparison.candidate, comparison));
    process.exit(comparison.regression ? 1 : 0);
  }

  if (action === 'generate') {
    const pack = args[1];
    if (!pack) {
      console.error('Usage: carina eval generate <pack>');
      process.exit(1);
    }
    const { resolvePack } = await import('../../skills/pack-resolver.js');
    const registry = await resolvePack(pack);
    const def = buildEvalDefinitionFromPack(pack, registry.skills);
    if (parseFlag(args, '--write')) {
      const evalPath = path.join(BUILTIN_PACKS_DIR, pack, 'eval', 'eval.json');
      await fs.mkdir(path.dirname(evalPath), { recursive: true });
      await fs.writeFile(evalPath, JSON.stringify(def, null, 2));
      console.log(`Wrote ${evalPath} (${def.fixtures.length} fixtures)`);
    } else {
      console.log(JSON.stringify(def, null, 2));
    }
    return;
  }

  if (action === 'gate') {
    const pack = args[1];
    if (!pack) {
      console.error('Usage: carina eval gate <pack> [--mode warn|require|bypass]');
      process.exit(1);
    }
    const modeArg = parseFlagValue(args, '--mode', '');
    const mode = modeArg
      ? (modeArg as 'warn' | 'require' | 'bypass')
      : resolveGateMode();
    const result = await runPackEvalGate(pack, { mode });
    console.log(result.message);
    if (result.runId) console.log(`Report: ${result.runId}`);
    if (result.blocked) process.exit(1);
    return;
  }

  if (action === 'authoring') {
    const pack = args[1];
    if (!pack) {
      console.error('Usage: carina eval authoring <pack>');
      process.exit(1);
    }
    const loop = await runAuthoringLoop({
      packName: pack,
      passes: Number(parseFlagValue(args, '--passes', '3')),
      writeEvalFile: !parseFlag(args, '--no-write'),
    });
    for (const note of loop.notes) console.log(note);
    if (loop.reportPath) console.log(`Report: ${loop.reportPath}`);
    process.exit(loop.approved ? 0 : 1);
  }

  if (action === 'reports') {
    const limit = Number(args[1] ?? '20');
    const reports = await listRecentReports(limit);
    if (reports.length === 0) {
      console.log('No eval reports found.');
      return;
    }
    for (const r of reports) {
      console.log(`${r.runId}  ${r.generatedAt}  ${r.result.pack}  ${(r.result.metrics.passRate * 100).toFixed(0)}%`);
    }
    return;
  }

  if (action === 'report') {
    const runId = args[1];
    if (!runId) {
      console.error('Usage: carina eval report <run-id>');
      process.exit(1);
    }
    const report = await loadReport(runId);
    if (!report) {
      console.error(`Report not found: ${runId}`);
      process.exit(1);
    }
    console.log(report.markdown);
    return;
  }

  console.error(`Unknown eval command: ${action}`);
  usage();
  process.exit(1);
}
