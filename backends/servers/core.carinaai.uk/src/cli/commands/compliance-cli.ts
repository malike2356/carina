import chalk from 'chalk';
import fs from 'node:fs/promises';
import { loadLocalEnv } from '../config/env.js';

function parseFrameworkFlag(args: string[]): string | undefined {
  return args.find((arg) => arg.startsWith('--framework='))?.split('=')[1]
    ?? (args.includes('--framework') ? args[args.indexOf('--framework') + 1] : undefined);
}

function parseDsarType(args: string[]): 'access' | 'delete' | 'portability' {
  const raw = args.find((arg) => arg.startsWith('--type='))?.split('=')[1]
    ?? (args.includes('--type') ? args[args.indexOf('--type') + 1] : 'access');
  if (raw === 'access' || raw === 'delete' || raw === 'portability') return raw;
  throw new Error(`Invalid DSAR type: ${raw}`);
}

export async function runComplianceCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'status';
  const json = args.includes('--json');

  if (action === 'status') {
    const {
      buildComplianceDashboard,
      buildComplianceDashboardFromCache,
      formatComplianceDashboard,
    } = await import('../../security/compliance/index.js');
    const dashboard = args.includes('--refresh')
      ? await buildComplianceDashboard()
      : await buildComplianceDashboardFromCache();
    if (json) {
      console.log(JSON.stringify(dashboard, null, 2));
    } else {
      console.log(formatComplianceDashboard(dashboard));
    }
    return;
  }

  if (action === 'collect') {
    const framework = parseFrameworkFlag(args);
    const { collectFramework, formatComplianceReport } = await import('../../security/compliance/index.js');
    const result = await collectFramework(framework);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (Array.isArray(result)) {
      for (const report of result) {
        console.log(formatComplianceReport(report));
        console.log('');
      }
    } else {
      console.log(formatComplianceReport(result));
    }
    return;
  }

  if (action === 'report') {
    const framework = parseFrameworkFlag(args) ?? 'all';
    const { generateComplianceReport } = await import('../../security/compliance/index.js');
    const markdown = await generateComplianceReport(framework);
    const outputArg = args.find((arg) => arg.startsWith('--output='))?.split('=')[1];
    if (outputArg) {
      await fs.writeFile(outputArg, markdown, 'utf8');
      console.log(chalk.green(`Compliance report written to ${outputArg}`));
      return;
    }
    if (json) {
      const { collectFramework } = await import('../../security/compliance/index.js');
      const result = await collectFramework(framework);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(markdown);
    }
    return;
  }

  if (action === 'gaps') {
    const {
      buildComplianceDashboardFromCache,
      formatComplianceDashboard,
      shouldBlockComplianceGaps,
    } = await import('../../security/compliance/index.js');
    const dashboard = args.includes('--refresh')
      ? await (await import('../../security/compliance/index.js')).buildComplianceDashboard()
      : await buildComplianceDashboardFromCache();
    if (json) {
      console.log(JSON.stringify({ gaps: dashboard.gaps, overallScorePercent: dashboard.overallScorePercent }, null, 2));
    } else {
      console.log(formatComplianceDashboard(dashboard));
    }
    const failOn = args.find((arg) => arg.startsWith('--fail-on='))?.split('=')[1] === 'warn'
      ? 'warn'
      : 'fail';
    if (shouldBlockComplianceGaps(dashboard, failOn)) process.exit(1);
    return;
  }

  if (action === 'dsar') {
    const userId = args[1];
    if (!userId) {
      console.error('Usage: carina compliance dsar <userId> --type access|delete|portability [--json]');
      process.exit(1);
    }
    const requestType = parseDsarType(args);
    const { handleDSAR } = await import('../../security/compliance/index.js');
    const result = await handleDSAR(userId, requestType);
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(chalk.green(result.summary));
      if (result.exportPath) console.log(chalk.gray(`Export: ${result.exportPath}`));
    }
    return;
  }

  if (action === 'breach') {
    const incidentId = args[1];
    if (!incidentId) {
      console.error('Usage: carina compliance breach <incidentId> [--json]');
      process.exit(1);
    }
    const { formatBreachNotification, handleBreachNotification } = await import('../../security/compliance/index.js');
    const notification = await handleBreachNotification(incidentId);
    if (!notification) {
      console.error(chalk.yellow('No breach notification required or incident not found.'));
      process.exit(1);
    }
    if (json) {
      console.log(JSON.stringify(notification, null, 2));
    } else {
      console.log(formatBreachNotification(notification));
    }
    return;
  }

  console.error('Usage: carina compliance <status|collect|report|gaps|dsar|breach> [--framework soc2|iso|gdpr|all] [--refresh] [--json] [--fail-on=warn|fail] [--output=path.md]');
  process.exit(1);
}
