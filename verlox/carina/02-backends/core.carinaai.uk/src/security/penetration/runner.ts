import type { PenTestScenario, PenTestReport, ScenarioResult } from './types.js';
import { evaluateAssertions } from './assertions.js';
import { filterScenarios, loadScenarios, resolveScenariosDir } from './loader.js';
import {
  createScenarioContext,
  evaluateRbacForMessage,
  probeEgress,
  resetPenTestRuntime,
  runScenarioStep,
} from './steps.js';

export type PenTestRunOptions = {
  scenariosDir?: string;
  criticalOnly?: boolean;
  name?: string;
  id?: string;
  alertOnCriticalFailure?: boolean;
};

export type SecurityAlertPayload = {
  scenarioId: string;
  scenarioName: string;
  severity: PenTestScenario['severity'];
  failures: ScenarioResult['failures'];
};

export async function alertSecurityTeam(payload: SecurityAlertPayload): Promise<void> {
  const line = `[PenTest] CRITICAL failure in ${payload.scenarioId}: ${payload.scenarioName}`;
  console.error(line);
  for (const failure of payload.failures) {
    console.error(`  - ${failure.key}: ${failure.message}`);
  }
}

export class PenTestRunner {
  constructor(private readonly options: PenTestRunOptions = {}) {}

  async runAll(): Promise<PenTestReport> {
    resetPenTestRuntime();
    const dir = resolveScenariosDir(this.options.scenariosDir);
    const scenarios = filterScenarios(loadScenarios(dir), {
      criticalOnly: this.options.criticalOnly,
      name: this.options.name,
      id: this.options.id,
    });

    const results: ScenarioResult[] = [];
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
      if (!result.passed && scenario.severity === 'critical' && this.options.alertOnCriticalFailure !== false) {
        await alertSecurityTeam({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          severity: scenario.severity,
          failures: result.failures,
        });
      }
    }

    return {
      totalScenarios: scenarios.length,
      passed: results.filter((row) => row.passed).length,
      failed: results.filter((row) => !row.passed).length,
      criticalFailures: results.filter((row) => !row.passed && row.severity === 'critical').length,
      results,
      generatedAt: new Date().toISOString(),
    };
  }

  async runScenario(scenario: PenTestScenario): Promise<ScenarioResult> {
    const started = Date.now();
    const ctx = await createScenarioContext(`pentest-${scenario.id}`);
    const failures = [];

    for (const step of scenario.steps) {
      if ('assert' in step) {
        await runScenarioStep(step, ctx);
        if (step.assert.tool_rbac === 'denied' && ctx.role) {
          const message = ctx.message?.toLowerCase() ?? '';
          const toolName = message.includes('process')
            ? 'process'
            : message.includes('shell') || message.includes('rm -rf') || message.includes('delete')
              ? 'shell-exec'
              : 'shell-exec';
          evaluateRbacForMessage(ctx, toolName);
        }
        if (step.assert.url && typeof step.assert.url === 'string') {
          const probe = await probeEgress(
            step.assert.url,
            typeof step.assert.body === 'string' ? step.assert.body : undefined,
          );
          ctx.egressBlocked = probe.blocked;
          ctx.egressReason = probe.reason;
          if (probe.blocked) ctx.toolResults.push('egress_filter:blocked');
        }
        failures.push(...evaluateAssertions(step.assert, ctx));
        continue;
      }
      await runScenarioStep(step, ctx);
    }

    return {
      id: scenario.id,
      name: scenario.name,
      severity: scenario.severity,
      passed: failures.length === 0,
      durationMs: Date.now() - started,
      failures,
      sourceFile: scenario.sourceFile,
    };
  }
}

export function formatPenTestSummary(report: PenTestReport): string {
  return [
    `Penetration tests: ${report.passed}/${report.totalScenarios} passed`,
    `Failed: ${report.failed} (${report.criticalFailures} critical)`,
  ].join('\n');
}

export function formatPenTestMarkdown(report: PenTestReport): string {
  const lines = [
    '# Carina penetration test report',
    '',
    `Generated: ${report.generatedAt}`,
    `Passed: ${report.passed}/${report.totalScenarios}`,
    `Critical failures: ${report.criticalFailures}`,
    '',
  ];

  if (report.results.every((row) => row.passed)) {
    lines.push('All scenarios passed.');
    return lines.join('\n');
  }

  lines.push('| Scenario | Severity | Result | Failures |');
  lines.push('|----------|----------|--------|---------:|');
  for (const result of report.results) {
    lines.push(`| ${result.name} | ${result.severity} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.failures.length} |`);
  }
  lines.push('');
  lines.push('## Failure details');
  for (const result of report.results.filter((row) => !row.passed)) {
    lines.push(`### ${result.name} (${result.id})`);
    for (const failure of result.failures) {
      lines.push(`- ${failure.key}: ${failure.message}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function shouldBlockCi(report: PenTestReport, criticalOnly = false): boolean {
  if (criticalOnly) return report.criticalFailures > 0;
  return report.failed > 0;
}

export async function runPenetrationTests(options: PenTestRunOptions = {}): Promise<PenTestReport> {
  return new PenTestRunner(options).runAll();
}
