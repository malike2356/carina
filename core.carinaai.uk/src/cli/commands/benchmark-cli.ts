import chalk from 'chalk';
import { runPlatformBenchmark, assertBenchmarkRegression } from '../../benchmark/runner.js';
import {
  generateMarkdownReport,
  generatePublicJson,
  listBenchmarkRuns,
  loadBenchmarkRun,
  saveBenchmarkReport,
} from '../../benchmark/report.js';
import { BENCHMARK_TASKS, listBenchmarkTaskIds } from '../../benchmark/definitions.js';
import { COMPETITOR_REFERENCES } from '../../benchmark/competitor-baselines.js';

function parseOutDir(args: string[]): string | undefined {
  const idx = args.indexOf('--out');
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

export async function runBenchmarkCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'run';
  const json = args.includes('--json');

  if (action === 'list') {
    const tasks = listBenchmarkTaskIds();
    if (json) {
      console.log(JSON.stringify({ tasks, count: tasks.length }, null, 2));
      return;
    }
    console.log(chalk.bold('\nBenchmark tasks\n'));
    for (const task of BENCHMARK_TASKS) {
      console.log(`  ${task.id}  [${task.category}]  ${task.title}`);
    }
    console.log(chalk.gray(`\n${tasks.length} tasks\n`));
    return;
  }

  if (action === 'runs') {
    const runs = listBenchmarkRuns();
    if (json) {
      console.log(JSON.stringify({ runs }, null, 2));
      return;
    }
    if (runs.length === 0) {
      console.log('No saved benchmark runs. Run: carina benchmark run');
      return;
    }
    for (const runId of runs) console.log(runId);
    return;
  }

  if (action === 'report') {
    const runId = args[1] ?? 'latest';
    const report = runId === 'latest'
      ? loadBenchmarkRun(listBenchmarkRuns()[0] ?? '')
      : loadBenchmarkRun(runId);
    if (!report) {
      console.error(`Benchmark run not found: ${runId}`);
      process.exit(1);
    }
    if (json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(generateMarkdownReport(report));
    return;
  }

  if (action === 'public') {
    const runId = args[1] ?? 'latest';
    const report = runId === 'latest'
      ? loadBenchmarkRun(listBenchmarkRuns()[0] ?? '')
      : loadBenchmarkRun(runId);
    if (!report) {
      console.error(`Benchmark run not found: ${runId}`);
      process.exit(1);
    }
    console.log(JSON.stringify(generatePublicJson(report), null, 2));
    return;
  }

  if (action === 'compare') {
    const report = await runPlatformBenchmark();
    const rows = report.comparison.map((row) => ({
      category: row.category,
      carina: row.carinaScore,
      hermes: row.references.find((r) => r.competitorId === 'hermes')?.referenceScore ?? null,
      openclaw: row.references.find((r) => r.competitorId === 'openclaw')?.referenceScore ?? null,
      odysseus: row.references.find((r) => r.competitorId === 'odysseus')?.referenceScore ?? null,
    }));
    if (json) {
      console.log(JSON.stringify({ disclaimer: report.disclaimer, rows, competitors: COMPETITOR_REFERENCES }, null, 2));
      return;
    }
    console.log(chalk.bold('\nCarina vs published references\n'));
    console.log(chalk.gray(report.disclaimer));
    console.log('');
    console.log('Category          Carina  Hermes  OpenClaw  Odysseus');
    for (const row of rows) {
      const pad = row.category.padEnd(16);
      console.log(
        `${pad}  ${String(row.carina).padStart(5)}  ${String(row.hermes ?? '-').padStart(6)}  ${String(row.openclaw ?? '-').padStart(8)}  ${String(row.odysseus ?? '-').padStart(8)}`,
      );
    }
    console.log('');
    return;
  }

  if (action === 'run') {
    const report = await runPlatformBenchmark();
    const saved = saveBenchmarkReport(report, parseOutDir(args));
    if (json) {
      console.log(JSON.stringify({ report, saved }, null, 2));
    } else {
      console.log(generateMarkdownReport(report));
      console.log(chalk.gray(`\nSaved: ${saved.mdPath}`));
      console.log(chalk.gray(`Public JSON: ${saved.publicJsonPath}`));
    }
    if (!report.overall.regressionPassed) {
      console.error(chalk.red(`Regression failed: ${report.overall.failedRegressionTasks.join(', ')}`));
      process.exit(1);
    }
    return;
  }

  if (action === 'regression') {
    const report = await runPlatformBenchmark();
    try {
      assertBenchmarkRegression(report);
      if (json) {
        console.log(JSON.stringify({ ok: true, overall: report.overall }, null, 2));
      } else {
        console.log(chalk.green('Benchmark regression passed'));
        console.log(`Overall: ${report.overall.percent}%`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (json) {
        console.log(JSON.stringify({ ok: false, error: msg, overall: report.overall }, null, 2));
      } else {
        console.error(chalk.red(msg));
      }
      process.exit(1);
    }
    return;
  }

  console.error('Usage: carina benchmark <run|regression|list|runs|report|public|compare> [--json] [--out dir]');
  process.exit(1);
}
