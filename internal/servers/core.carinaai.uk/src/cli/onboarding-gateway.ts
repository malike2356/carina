import chalk from 'chalk';
import { confirm, select } from '@inquirer/prompts';
import { CHANNEL_SETUP } from './commands/channels.js';
import { ensureAgentsConfig, listBindings } from '../workspaces/agent-registry.js';
import { ROUTING_PRECEDENCE } from '../workspaces/routing-explain.js';
import { starterChannelNeedsSecurityDefaults } from '../security/channel-security-defaults.js';

export type StarterChannel = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'web' | 'skip';

export type GatewayOnboardingPrompts = {
  confirm: typeof confirm;
  select: typeof select;
};

const defaultPrompts: GatewayOnboardingPrompts = { confirm, select };

export const STARTER_CHANNEL_CHOICES: { name: string; value: StarterChannel }[] = [
  { name: 'Telegram bot (fastest to test)', value: 'telegram' },
  { name: 'Discord bot', value: 'discord' },
  { name: 'Slack app (socket mode)', value: 'slack' },
  { name: 'WhatsApp (Baileys QR scan)', value: 'whatsapp' },
  { name: 'Web chat only (browser UI)', value: 'web' },
  { name: 'Skip for now', value: 'skip' },
];

export function printRoutingCheatSheet(): void {
  console.log(chalk.bold('\nRouting rules\n'));
  console.log(chalk.gray('  Inbound messages pick an agent workspace by binding precedence:'));
  for (const line of ROUTING_PRECEDENCE) {
    console.log(chalk.gray(`    - ${line}`));
  }
  console.log('');
  console.log(chalk.white('  Test a route:'));
  console.log(chalk.cyan('    carina agents route --channel telegram --peer direct:12345'));
  console.log(chalk.white('  Add a binding:'));
  console.log(chalk.cyan('    carina agents bind add work telegram'));
  console.log(chalk.cyan('    carina agents bind add family whatsapp --peer group:120363@g.us'));
  console.log(chalk.white('  List bindings:'));
  console.log(chalk.cyan('    carina agents list --bindings'));
  console.log('');
}

export function printChannelSetupGuide(channel: StarterChannel): void {
  if (channel === 'skip') return;

  const info = CHANNEL_SETUP[channel];
  if (!info) return;

  console.log(chalk.bold(`\n${channel} setup\n`));
  console.log(`  ${info.note}`);
  console.log(chalk.white('\n  Required env (~/.carina/.env):'));
  for (const env of info.env) {
    console.log(chalk.gray(`    ${env}`));
  }
  if (info.webhook) {
    console.log(chalk.white(`\n  Inbound webhook: POST ${info.webhook}`));
  }
  console.log(chalk.white('\n  Full guide:'));
  console.log(chalk.cyan(`    carina channels setup ${channel}`));
  console.log(chalk.cyan(`    carina gateway start`));
  console.log(chalk.gray('  After editing .env: carina secrets reload (or restart gateway)'));
  console.log('');
}

export function printGatewayNextSteps(opts: {
  channel?: StarterChannel;
  daemonInstalled?: boolean;
  webPort?: string;
} = {}): void {
  const port = opts.webPort ?? process.env.WEB_PORT ?? '3000';
  console.log(chalk.bold('\nNext steps\n'));
  if (opts.daemonInstalled) {
    console.log(chalk.green('  Background gateway installed. Check: carina host status'));
  } else {
    console.log(chalk.white('  Start the gateway:'));
    console.log(chalk.cyan('    carina gateway start'));
    console.log(chalk.gray('    or: carina host install && carina host start'));
  }
  console.log(chalk.white('\n  Open web chat:'));
  console.log(chalk.cyan(`    http://localhost:${port}`));
  console.log(chalk.white('\n  Mobile companion:'));
  console.log(chalk.cyan('    carina pair'));
  console.log(chalk.cyan(`    http://localhost:${port}/mobile`));
  if (opts.channel && opts.channel !== 'skip') {
    console.log(chalk.white(`\n  Finish ${opts.channel} credentials in ~/.carina/.env, then:`));
    console.log(chalk.cyan(`    carina channels setup ${opts.channel}`));
  }
  console.log(chalk.white('\n  Channel health:'));
  console.log(chalk.cyan('    carina channels status'));
  console.log(chalk.white('\n  Messenger commands (after connected):'));
  console.log(chalk.gray('    /help  /model  /new  /stop  /status'));
  console.log(chalk.white('\n  Same thread on phone + CLI + web (optional):'));
  console.log(chalk.cyan('    CARINA_OPERATOR_SESSION=true   # in ~/.carina/.env'));
  console.log(chalk.white('\n  Remote access (read before exposing ports):'));
  console.log(chalk.cyan('    docs/gateways/remote-access.md'));
  printRoutingCheatSheet();
}

export async function runGatewayOnboardingStep(
  prompts: GatewayOnboardingPrompts = defaultPrompts,
): Promise<{ channel: StarterChannel; daemonInstalled: boolean }> {
  await ensureAgentsConfig();

  const bindings = listBindings();
  if (bindings.length === 1 && bindings[0]?.match.channel === '*') {
    console.log(chalk.gray('\n  Default routing: all channels -> main agent (agents.json)'));
  }

  const installDaemon = await prompts.confirm({
    message: 'Install background gateway daemon (starts on login)?',
    default: false,
  });

  let daemonInstalled = false;
  if (installDaemon) {
    try {
      const { installHostService, startHostService, defaultGatewayCommand } = await import('../host/daemon.js');
      await installHostService(defaultGatewayCommand());
      const started = await startHostService(defaultGatewayCommand());
      daemonInstalled = true;
      console.log(chalk.green(`\n  Gateway daemon started (PID ${started.pid})`));
      console.log(chalk.gray(`  URL: ${started.url}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.yellow(`\n  Daemon install skipped: ${msg}`));
      console.log(chalk.gray('  Run manually: carina host install && carina host start'));
    }
  }

  const channel = await prompts.select<StarterChannel>({
    message: 'Connect your first channel now?',
    choices: STARTER_CHANNEL_CHOICES,
    default: 'telegram',
  });

  printChannelSetupGuide(channel);
  if (starterChannelNeedsSecurityDefaults(channel)) {
    const { persistChannelSecurityDefaults } = await import('../security/channel-security-defaults.js');
    const applied = await persistChannelSecurityDefaults(channel);
    if (applied.length > 0) {
      console.log(chalk.green('\n  Security defaults applied for messenger channel:'));
      for (const line of applied) console.log(chalk.gray(`    ${line}`));
      console.log(chalk.gray('  Unknown DMs stay pending until: carina channels dm approve <channel> <peerId>'));
    }
  }
  printGatewayNextSteps({ channel, daemonInstalled });

  return { channel, daemonInstalled };
}
