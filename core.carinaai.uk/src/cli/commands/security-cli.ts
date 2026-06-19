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

  console.error('Usage: carina security <audit|status|trust|doctor|advisories|events|report|totp> [--json] [--refresh] [--category=prompt_injection] [--limit=N] [--output=path.md]');
  process.exit(1);
}
