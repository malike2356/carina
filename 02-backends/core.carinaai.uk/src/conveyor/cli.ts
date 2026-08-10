#!/usr/bin/env node
/**
 * CLI: conveyor audit|pipeline|status
 */
import path from 'node:path';
import { runFullAudit } from './production-audit.js';
import { generateFixesForReport } from './fix-generator.js';
import { pipelineStatus, runPipeline } from './pipeline-runner.js';

async function main(argv: string[]): Promise<void> {
  const [, , cmd, projectArg, envArg] = argv;
  const projectPath = path.resolve(projectArg || '.');

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`Usage:
  conveyor audit <projectPath>
  conveyor pipeline <projectPath> <targetEnv> [--approve]
  conveyor status
`);
    process.exit(cmd ? 0 : 1);
  }

  if (cmd === 'status') {
    console.log(JSON.stringify(pipelineStatus(), null, 2));
    return;
  }

  if (cmd === 'audit') {
    const report = runFullAudit(projectPath);
    const fixes = generateFixesForReport(report.layers);
    console.log(JSON.stringify({ report, fixes }, null, 2));
    process.exit(report.passed ? 0 : 1);
  }

  if (cmd === 'pipeline') {
    const approve = argv.includes('--approve');
    const result = await runPipeline(projectPath, envArg || 'staging', {
      humanApproval: approve,
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.report.passed ? 0 : 1);
  }

  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}

main(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
