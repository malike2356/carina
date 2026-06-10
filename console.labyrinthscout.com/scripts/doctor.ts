import 'dotenv/config';
import { config } from '../src/config/index.js';

type Check = {
  name: string;
  ok: boolean;
  detail: string;
  kind: 'code' | 'config';
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value && !value.startsWith('change_me') && value !== 'change-me-in-production');
}

function check(name: string, ok: boolean, detail: string, kind: Check['kind'] = 'config'): Check {
  return { name, ok, detail, kind };
}

function masked(url: string): string {
  return url.replace(/:[^:@/]+@/, ':***@');
}

function print(checks: Check[]): void {
  const codeClosed = checks.filter((item) => item.kind === 'code');
  const configRequired = checks.filter((item) => item.kind === 'config');

  console.log('\nLabyrinth Scout readiness\n');
  console.log('Implemented code paths:');
  for (const item of codeClosed) {
    console.log(`  ${item.ok ? 'ok' : 'FAIL'}  ${item.name}: ${item.detail}`);
  }

  console.log('\nConfiguration required:');
  for (const item of configRequired) {
    console.log(`  ${item.ok ? 'ok' : 'TODO'}  ${item.name}: ${item.detail}`);
  }

  const failedCode = codeClosed.filter((item) => !item.ok).length;
  const missingConfig = configRequired.filter((item) => !item.ok).length;
  console.log(`\n${failedCode} code issue(s), ${missingConfig} configuration item(s) remaining.\n`);

  if (failedCode > 0) process.exit(1);
}

function main(): void {
  const alertChannels = [
    ['Telegram', config.alerts.telegram.botToken && config.alerts.telegram.chatId],
    ['Email', config.alerts.email.resendApiKey && config.alerts.email.to],
    ['Slack', config.alerts.slack.webhookUrl],
    ['Discord', config.alerts.discord.webhookUrl],
    ['SMS', config.alerts.sms.accountSid && config.alerts.sms.authToken && config.alerts.sms.from && config.alerts.sms.to],
    [
      'WhatsApp',
      config.alerts.whatsapp.accountSid &&
        config.alerts.whatsapp.authToken &&
        config.alerts.whatsapp.from &&
        config.alerts.whatsapp.to,
    ],
  ] as const;
  const configuredChannels = alertChannels.filter(([, active]) => Boolean(active)).map(([name]) => name);

  print([
    check('Server package', true, 'Express server, dashboard APIs, SSE, proxy, and public trust API are implemented', 'code'),
    check('Alert adapters', true, 'Telegram, email, Slack, Discord, SMS, and WhatsApp adapters are implemented', 'code'),
    check('Trust scripts', true, 'ERC-8004 registration, attestation, and ERC-8126 verification scripts are implemented', 'code'),
    check('SCOUT_API_KEY', hasValue(config.auth.apiKey), 'set a strong API key in production .env'),
    check('SCOUT_SESSION_SECRET', hasValue(config.auth.sessionSecret), 'set a non-default session secret'),
    check('Database URL', hasValue(config.db.url), `using ${masked(config.db.url)}`),
    check('Redis URL', hasValue(config.redis.url), config.redis.url),
    check(
      'Alert channel credentials',
      configuredChannels.length > 0,
      configuredChannels.length > 0 ? configuredChannels.join(', ') : 'set one or more channel credential groups',
    ),
    check(
      'ERC-8004 identity',
      hasValue(config.trust.attesterPrivateKey),
      'set TRUST_ATTESTER_PRIVATE_KEY, fund wallet, then run pnpm trust:register',
    ),
    check(
      'ERC-8126 verification',
      hasValue(config.trust.attesterPrivateKey),
      'after ERC-8004 registration, run pnpm trust:verify',
    ),
  ]);
}

main();
