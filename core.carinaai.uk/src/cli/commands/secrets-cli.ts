import fs from 'fs';
import { confirm } from '@inquirer/prompts';
import { CARINA_ENV_PATH } from '../../config/paths.js';
import { appendEnvValue } from '../config/loader.js';
import { auditSecrets } from '../../ops/secrets-audit.js';

function redact(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function runSecretsCommand(args: string[]): Promise<void> {
  const action = args[0] ?? 'list';
  const json = args.includes('--json');

  if (action === 'list') {
    if (!fs.existsSync(CARINA_ENV_PATH)) {
      console.log('No .env file.');
      return;
    }
    const lines = fs.readFileSync(CARINA_ENV_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      if (!line.trim() || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const key = line.slice(0, idx);
      const value = line.slice(idx + 1);
      const isSecret = /(_API_KEY|_TOKEN|_SECRET|PASSWORD)/i.test(key);
      console.log(`  ${key}=${isSecret ? redact(value) : value}  (env-file)`);
    }
    return;
  }

  if (action === 'audit') {
    const report = auditSecrets({ includeProcessEnv: true });
    if (json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(`Secrets audit (${report.summary.ok} ok, ${report.summary.warn} warn, ${report.summary.fail} fail)`);
    for (const f of report.findings) {
      const tag = f.severity === 'ok' ? 'ok' : f.severity === 'warn' ? 'WARN' : 'FAIL';
      console.log(`  [${tag}] ${f.source} ${f.key}: ${f.detail}`);
    }
    if (report.precedenceDrift.length > 0) {
      console.log('\nPrecedence drift:');
      for (const d of report.precedenceDrift) console.log(`  - ${d}`);
    }
    if (report.unresolvedRefs.length > 0) {
      console.log('\nUnresolved references:');
      for (const u of report.unresolvedRefs) console.log(`  - ${u}`);
    }
    if (report.summary.fail > 0) process.exit(1);
    return;
  }

  if (action === 'review') {
    const report = auditSecrets({ includeProcessEnv: true });
    const issues = report.findings.filter((f) => f.severity !== 'ok');
    if (issues.length === 0) {
      console.log('No secret issues found.');
      return;
    }
    for (const f of issues) {
      console.log(`\n[${f.severity}] ${f.key}: ${f.detail}`);
      const rotate = await confirm({ message: 'Set a new value in .env now?', default: false });
      if (!rotate) continue;
      const { input } = await import('@inquirer/prompts');
      const value = await input({ message: `${f.key} value`, validate: (v) => (v.trim() ? true : 'required') });
      await appendEnvValue(f.key, value.trim());
      console.log(`Updated ${f.key}`);
    }
    return;
  }

  if (action === 'set') {
    const key = args[1];
    const value = args.slice(2).join(' ');
    if (!key || !value) {
      console.error('Usage: carina secrets set <KEY> <value>');
      process.exit(1);
    }
    await appendEnvValue(key, value);
    console.log(`Set ${key} in .env`);
    return;
  }

  if (action === 'reload') {
    const { reloadSecrets } = await import('../../ops/secrets-reload.js');
    const notify = args.includes('--notify');
    const result = await reloadSecrets({ overwrite: true, notifyGateway: notify });
    console.log(`Reloaded ${result.reloaded.length} env key(s)`);
    if (notify) {
      console.log(result.gatewayNotified ? 'Gateway notified' : 'Gateway not reachable');
    }
    return;
  }

  console.error('Usage: carina secrets <list|audit|review|set|reload> [--json]');
  process.exit(1);
}
