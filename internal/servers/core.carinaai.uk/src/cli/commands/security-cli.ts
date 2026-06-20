import chalk from 'chalk';
import fs from 'fs/promises';
import { loadLocalEnv } from '../config/env.js';
import { runSecurityAudit } from '../../ops/security-audit.js';
import { buildSecurityTrustState, formatTrustStateSummary } from '../../security/trust-state.js';
import {
  buildTrustComplianceReport,
  formatTrustComplianceMarkdown,
} from '../../security/trust-compliance-report.js';
import { searchSecurityAudit } from '../../security/security-audit.js';

export async function runSecurityCommand(args: string[]): Promise<void> {
  loadLocalEnv();
  const action = args[0] ?? 'audit';

  if (action === 'doctor') {
    const { collectSecurityDoctorChecks } = await import('../../security/security-doctor.js');
    const checks = collectSecurityDoctorChecks();
    if (args.includes('--json')) {
      console.log(JSON.stringify(checks, null, 2));
      return;
    }
    console.log(chalk.bold('\nSecurity doctor\n'));
    for (const c of checks) {
      const icon = c.severity === 'ok'
        ? chalk.green('ok')
        : c.severity === 'fail'
          ? chalk.red('FAIL')
          : chalk.yellow('warn');
      console.log(`  ${icon}  [${c.id}] ${c.name}: ${c.detail}`);
    }
    const fails = checks.filter((c) => c.severity === 'fail').length;
    console.log('');
    if (fails > 0) process.exit(1);
    return;
  }

  if (action === 'advisories') {
    const {
      advisoriesFeedEnabled,
      listSecurityAdvisories,
      refreshSecurityAdvisoriesFeed,
    } = await import('../../security/security-advisories.js');
    if (!advisoriesFeedEnabled()) {
      console.log(chalk.yellow('Security advisories feed disabled (CARINA_SECURITY_ADVISORIES=false).'));
      return;
    }
    if (args.includes('--refresh')) {
      const result = await refreshSecurityAdvisoriesFeed();
      console.log(chalk.gray(`Refreshed advisories (${result.source}, ${result.fetched} entries).`));
    }
    const rows = listSecurityAdvisories();
    if (args.includes('--json')) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    console.log(chalk.bold(`\nSecurity advisories (${rows.length})\n`));
    for (const row of rows) {
      console.log(`  [${row.severity}] ${row.id}: ${row.title}`);
      console.log(chalk.gray(`    ${row.summary}`));
    }
    console.log('');
    return;
  }

  if (action === 'trust') {
    const state = await buildSecurityTrustState();
    if (args.includes('--json')) {
      console.log(JSON.stringify(state, null, 2));
      return;
    }
    console.log(chalk.bold('\nSecurity trust state\n'));
    console.log(formatTrustStateSummary(state));
    if (state.recentSecurityAudit.length > 0) {
      console.log(chalk.gray('\nRecent security audit events:'));
      for (const row of state.recentSecurityAudit.slice(-5)) {
        console.log(`  ${row.at} [${row.category}] ${row.action}: ${row.detail}`);
      }
    }
    console.log('');
    return;
  }

  if (action === 'events') {
    const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
    const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? '30');
    const rows = searchSecurityAudit({
      category: categoryArg as 'prompt_injection' | undefined,
      limit,
    });
    if (args.includes('--json')) {
      console.log(JSON.stringify(rows, null, 2));
      return;
    }
    console.log(chalk.bold(`\nSecurity audit events (${rows.length})\n`));
    for (const row of rows) {
      const ref = row.metadata?.shield_ref ? ` ref=${String(row.metadata.shield_ref)}` : '';
      console.log(`  ${row.at} [${row.category}] ${row.action}${ref}: ${row.detail}`);
    }
    console.log('');
    return;
  }

  if (action === 'totp') {
    const sub = args[1] ?? 'status';
    const { buildOtpAuthUrl, generateTotpSecret } = await import('../../auth/web-totp.js');
    const {
      clearWebTotpConfig,
      readWebTotpConfig,
      webTotpSecretFromEnv,
      writeWebTotpConfig,
    } = await import('../../auth/web-totp-store.js');

    if (sub === 'status') {
      const env = Boolean(webTotpSecretFromEnv());
      const file = await readWebTotpConfig();
      console.log(`Web TOTP: ${env || file?.enabled ? 'enabled' : 'disabled'}`);
      if (env) console.log(chalk.gray('  Source: CARINA_WEB_TOTP_SECRET env var'));
      if (file?.enabledAt) console.log(chalk.gray(`  Enabled at: ${file.enabledAt}`));
      return;
    }

    if (sub === 'enable') {
      if (webTotpSecretFromEnv()) {
        console.log(chalk.yellow('TOTP already enabled via CARINA_WEB_TOTP_SECRET.'));
        return;
      }
      const secret = generateTotpSecret();
      await writeWebTotpConfig({
        enabled: true,
        secret,
        enabledAt: new Date().toISOString(),
      });
      console.log(chalk.green('Web TOTP enabled.'));
      console.log(`Secret (base32): ${secret}`);
      console.log(`Authenticator URL: ${buildOtpAuthUrl(secret)}`);
      console.log(chalk.gray('Add the secret to your authenticator app, then sign in with password + code.'));
      return;
    }

    if (sub === 'disable') {
      await clearWebTotpConfig();
      console.log(chalk.green('File-based web TOTP disabled.'));
      if (webTotpSecretFromEnv()) {
        console.log(chalk.yellow('CARINA_WEB_TOTP_SECRET is still set in the environment.'));
      }
      return;
    }

    console.error('Usage: carina security totp <status|enable|disable>');
    process.exit(1);
  }

  if (action === 'sbom') {
    const sub = args[1] ?? 'generate';
    const {
      formatSbomSummary,
      generateSbom,
      resolveProjectRoot,
      sbomOutputPath,
      writeSbom,
    } = await import('../../security/supply-chain/index.js');
    const projectRoot = resolveProjectRoot();
    if (sub === 'export') {
      const format = args.find((arg) => arg.startsWith('--format='))?.split('=')[1] ?? 'json';
      const output = args.find((arg) => arg.startsWith('--output='))?.split('=')[1]
        ?? sbomOutputPath(projectRoot);
      const sbom = await writeSbom(projectRoot, output);
      if (args.includes('--json')) {
        console.log(JSON.stringify(sbom, null, 2));
      } else {
        console.log(chalk.green(`SBOM exported (${format}) to ${output}`));
        console.log(formatSbomSummary(sbom));
      }
      return;
    }
    const sbom = await generateSbom(projectRoot);
    if (args.includes('--json')) {
      console.log(JSON.stringify(sbom, null, 2));
    } else {
      console.log(formatSbomSummary(sbom));
    }
    return;
  }

  if (action === 'deps') {
    const sub = args[1] ?? 'scan';
    const {
      formatDependencyScanSummary,
      resolveProjectRoot,
      runDependencyAudit,
      scanDependencies,
      shouldBlockDependencyScan,
    } = await import('../../security/supply-chain/index.js');
    const projectRoot = resolveProjectRoot();
    const failOn = args.some((arg) => arg === '--fail-on=high' || arg === '--fail-on-high')
      ? 'high'
      : 'critical';
    const report = sub === 'audit'
      ? await runDependencyAudit(projectRoot)
      : await scanDependencies(projectRoot);
    if (args.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatDependencyScanSummary(report));
      if (report.findings.length > 0) {
        console.log('');
        for (const finding of report.findings.slice(0, 20)) {
          console.log(`  [${finding.severity}] ${finding.module}: ${finding.title}`);
        }
      }
    }
    if (args.includes('--fail-on') || args.includes('--fail-on=critical') || args.includes('--fail-on=high') || args.includes('--fail-on-high')) {
      if (shouldBlockDependencyScan(report, failOn)) process.exit(1);
    }
    return;
  }

  if (action === 'provenance') {
    const sub = args[1] ?? 'check';
    const target = args[2];
    if (sub !== 'check' || !target) {
      console.error('Usage: carina security provenance check <skill|pack> [--require-hub] [--json]');
      process.exit(1);
    }
    const {
      checkProvenance,
      formatProvenanceSummary,
      shouldBlockProvenance,
    } = await import('../../security/supply-chain/index.js');
    const result = await checkProvenance(target, {
      requireHubVerified: args.includes('--require-hub'),
    });
    if (args.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatProvenanceSummary(result));
    }
    if (shouldBlockProvenance(result)) process.exit(1);
    return;
  }

  if (action === 'secrets') {
    const sub = args[1] ?? 'status';
    const {
      auditStaleSecrets,
      buildSecretsStatusReport,
      formatSecretsStatus,
      formatStaleAudit,
      parseDuration,
      rotateProvider,
      scheduleProvider,
      shouldBlockStaleSecretsAudit,
    } = await import('../../security/secrets/index.js');

    if (sub === 'status') {
      const report = await buildSecretsStatusReport();
      if (args.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatSecretsStatus(report));
      }
      return;
    }

    if (sub === 'audit') {
      const report = await auditStaleSecrets();
      if (args.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatStaleAudit(report));
      }
      const failOn = args.find((arg) => arg.startsWith('--fail-on='))?.split('=')[1] === 'warn'
        ? 'warn'
        : 'fail';
      if (shouldBlockStaleSecretsAudit(report, failOn)) process.exit(1);
      return;
    }

    if (sub === 'rotate') {
      const provider = args[2];
      if (!provider) {
        console.error('Usage: carina security secrets rotate <provider> [--value=KEY] [--dry-run]');
        process.exit(1);
      }
      const valueArg = args.find((arg) => arg.startsWith('--value='))?.split('=')[1]
        ?? (args.includes('--value') ? args[args.indexOf('--value') + 1] : undefined);
      const result = await rotateProvider(provider, {
        newValue: valueArg,
        dryRun: args.includes('--dry-run'),
      });
      if (args.includes('--json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.message);
      }
      return;
    }

    if (sub === 'schedule') {
      const provider = args[2];
      if (!provider) {
        console.error('Usage: carina security secrets schedule <provider> [--max-age=90d] [--auto]');
        process.exit(1);
      }
      const maxAgeArg = args.find((arg) => arg.startsWith('--max-age='))?.split('=')[1]
        ?? (args.includes('--max-age') ? args[args.indexOf('--max-age') + 1] : undefined);
      await scheduleProvider(provider, {
        maxAgeMs: maxAgeArg ? parseDuration(maxAgeArg) : undefined,
        autoRotate: args.includes('--auto'),
      });
      console.log(chalk.green(`Rotation schedule saved for ${provider}`));
      return;
    }

    console.error('Usage: carina security secrets <status|audit|rotate|schedule> ...');
    process.exit(1);
  }

  if (action === 'rasp') {
    const sub = args[1] ?? 'status';
    const {
      buildRaspStatus,
      formatAttackGraph,
      formatRaspStatus,
      formatThreatAssessment,
      getAssessment,
      getRaspEngine,
    } = await import('../../security/rasp/index.js');

    if (sub === 'status') {
      const status = await buildRaspStatus();
      if (args.includes('--json')) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log(formatRaspStatus(status));
      }
      return;
    }

    if (sub === 'signals') {
      const sessionId = args.find((arg) => arg.startsWith('--session='))?.split('=')[1]
        ?? (args.includes('--session') ? args[args.indexOf('--session') + 1] : undefined);
      const signals = getRaspEngine().getActiveSignals(sessionId);
      if (args.includes('--json')) {
        console.log(JSON.stringify(signals, null, 2));
      } else {
        console.log(`Active RASP signals (${signals.length})`);
        for (const row of signals) {
          console.log(`  [${row.source}] ${row.type} severity=${row.severity} session=${row.context.sessionId}`);
        }
      }
      return;
    }

    if (sub === 'threat') {
      const id = args[2];
      if (!id) {
        console.error('Usage: carina security rasp threat <assessmentId> [--json]');
        process.exit(1);
      }
      const assessment = await getAssessment(id);
      if (!assessment) {
        console.error(chalk.red(`Assessment not found: ${id}`));
        process.exit(1);
      }
      if (args.includes('--json')) {
        console.log(JSON.stringify(assessment, null, 2));
      } else {
        console.log(formatThreatAssessment(assessment));
      }
      return;
    }

    if (sub === 'graph') {
      const id = args[2];
      if (!id) {
        console.error('Usage: carina security rasp graph <assessmentId> [--json]');
        process.exit(1);
      }
      const assessment = await getAssessment(id);
      if (!assessment) {
        console.error(chalk.red(`Assessment not found: ${id}`));
        process.exit(1);
      }
      if (args.includes('--json')) {
        console.log(JSON.stringify(assessment.attackGraph, null, 2));
      } else {
        console.log(formatAttackGraph(assessment));
      }
      return;
    }

    console.error('Usage: carina security rasp <status|signals|threat|graph> ...');
    process.exit(1);
  }

  if (action === 'red-team') {
    const sub = args[1] ?? 'report';
    const {
      buildLatestReport,
      buildScheduleView,
      formatRedTeamReport,
      formatRedTeamResult,
      formatRedTeamSchedule,
      isRedTeamEnabled,
      listUnresolvedGaps,
      redTeamAutomation,
      shouldBlockRedTeamGaps,
    } = await import('../../security/red-team/index.js');

    if (!isRedTeamEnabled()) {
      console.log(chalk.yellow('Red team automation disabled (CARINA_RED_TEAM_ENABLED=false).'));
      return;
    }

    if (sub === 'run') {
      const exerciseId = args[2];
      const runAll = args.includes('--all') || exerciseId === '--all';
      if (runAll) {
        const results = await redTeamAutomation.runAll();
        if (args.includes('--json')) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          for (const result of results) {
            console.log(formatRedTeamResult(result));
            console.log('');
          }
        }
        return;
      }
      if (!exerciseId) {
        console.error('Usage: carina security red-team run <exercise>|--all [--json]');
        process.exit(1);
      }
      const result = await redTeamAutomation.runExercise(exerciseId);
      if (args.includes('--json')) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatRedTeamResult(result));
      }
      return;
    }

    if (sub === 'schedule') {
      const schedule = await buildScheduleView();
      if (args.includes('--json')) {
        console.log(JSON.stringify(schedule, null, 2));
      } else {
        console.log(formatRedTeamSchedule(schedule));
      }
      return;
    }

    if (sub === 'report') {
      const report = await buildLatestReport();
      if (args.includes('--json')) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatRedTeamReport(report));
      }
      return;
    }

    if (sub === 'gaps') {
      const gaps = await listUnresolvedGaps();
      if (args.includes('--json')) {
        console.log(JSON.stringify(gaps, null, 2));
      } else {
        if (gaps.length === 0) {
          console.log(chalk.green('No unresolved red team gaps.'));
        } else {
          for (const gap of gaps) {
            console.log(`  [${gap.severity}] ${gap.system}: ${gap.description}`);
            console.log(chalk.gray(`    ${gap.recommendation}`));
          }
        }
      }
      const failOn = args.find((arg) => arg.startsWith('--fail-on='))?.split('=')[1] === 'high'
        ? 'high'
        : 'critical';
      if (shouldBlockRedTeamGaps(gaps, failOn)) process.exit(1);
      return;
    }

    console.error('Usage: carina security red-team <run|schedule|report|gaps> ...');
    process.exit(1);
  }

  if (action === 'pentest') {
    const nameArg = args.find((arg) => arg.startsWith('--name='))?.split('=')[1]
      ?? (args.includes('--name') ? args[args.indexOf('--name') + 1] : undefined);
    const idArg = args.find((arg) => arg.startsWith('--id='))?.split('=')[1];
    const {
      formatPenTestMarkdown,
      formatPenTestSummary,
      runPenetrationTests,
      shouldBlockCi,
    } = await import('../../security/penetration/runner.js');
    const report = await runPenetrationTests({
      criticalOnly: args.includes('--critical'),
      name: nameArg,
      id: idArg,
    });
    if (args.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatPenTestSummary(report));
      console.log('');
      console.log(formatPenTestMarkdown(report));
    }
    if (shouldBlockCi(report, args.includes('--critical'))) process.exit(1);
    return;
  }

  if (action === 'review') {
    const paths = args.filter((a) => !a.startsWith('--') && a !== 'review');
    const { collectReviewTargets, defaultAuditRunner, resolveRepoRoot } = await import('../../security/automated-review/git-changes.js');
    const {
      formatReviewMarkdown,
      formatReviewSummary,
      runSecurityReview,
      shouldBlockCi,
    } = await import('../../security/automated-review/review-bot.js');
    const repoRoot = resolveRepoRoot();
    const files = collectReviewTargets(repoRoot, { paths: paths.length > 0 ? paths : undefined });
    const review = await runSecurityReview({
      files,
      includeDependencyScan: !args.includes('--skip-audit'),
      runAudit: defaultAuditRunner(repoRoot),
      skipScout: args.includes('--skip-scout'),
    });
    if (args.includes('--json')) {
      console.log(JSON.stringify(review, null, 2));
    } else {
      console.log(formatReviewSummary(review));
      console.log('');
      console.log(formatReviewMarkdown(review));
    }
    if (shouldBlockCi(review)) process.exit(1);
    return;
  }

  if (action === 'dashboard') {
    const {
      buildSecurityDashboardData,
      formatDashboardSummary,
      formatDashboardTui,
    } = await import('../../security/dashboard/index.js');
    const data = await buildSecurityDashboardData();
    if (args.includes('--json')) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    if (args.includes('--tui')) {
      console.log(formatDashboardTui(data));
      return;
    }
    console.log(chalk.bold('\nSecurity operations dashboard\n'));
    console.log(formatDashboardSummary(data));
    console.log('');
    return;
  }

  if (action === 'report') {
    const report = await buildTrustComplianceReport();
    if (args.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    const markdown = formatTrustComplianceMarkdown(report);
    const outputArg = args.find((a) => a.startsWith('--output='))?.split('=')[1];
    if (outputArg) {
      await fs.writeFile(outputArg, markdown, 'utf8');
      console.log(chalk.green(`Compliance report written to ${outputArg}`));
      return;
    }
    console.log(markdown);
    return;
  }

  if (action === 'audit' || action === 'status') {
    const report = await runSecurityAudit();
    if (args.includes('--json')) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(chalk.bold('\nSecurity audit\n'));
    for (const c of report.checks) {
      const icon = c.severity === 'ok'
        ? chalk.green('ok')
        : c.severity === 'fail'
          ? chalk.red('FAIL')
          : chalk.yellow('warn');
      console.log(`  ${icon}  ${c.name}: ${c.detail}`);
    }
    console.log(
      chalk.gray(
        `\n${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail\n`,
      ),
    );
    if (report.summary.fail > 0) process.exit(1);
    return;
  }

  console.error('Usage: carina security <audit|status|trust|doctor|advisories|events|report|review|pentest|sbom|deps|provenance|secrets|rasp|red-team|dashboard|totp> [--json] [--refresh] [--skip-audit] [--skip-scout] [--critical] [--fail-on=critical|high|warn|fail] [--name=id-or-slug] [--id=scenario-id] [--tui] [paths...] [--category=prompt_injection] [--limit=N] [--output=path.md] [--session=ID]');
  process.exit(1);
}
