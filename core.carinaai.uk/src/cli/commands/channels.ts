import chalk from 'chalk';
import { channelRegistry } from '../../gateway/channels/channel-registry.js';

const CHANNEL_SETUP: Record<string, { env: string[]; note: string }> = {
  telegram: { env: ['TELEGRAM_BOT_TOKEN'], note: 'Native long-polling bot' },
  discord: { env: ['DISCORD_BOT_TOKEN'], note: 'Native gateway' },
  slack: { env: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'], note: 'Socket mode' },
  whatsapp: { env: ['BAILEYS_WHATSAPP_ENABLED=true', 'or TWILIO_*'], note: 'Baileys live or Twilio webhook' },
  sms: { env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'], note: 'Twilio SMS' },
  signal: { env: ['SIGNAL_API_URL', 'SIGNAL_API_KEY'], note: 'signal-cli-rest-api sidecar' },
  matrix: { env: ['MATRIX_HOMESERVER_URL', 'MATRIX_ACCESS_TOKEN'], note: 'Matrix bot account' },
  mattermost: { env: ['MATTERMOST_URL', 'MATTERMOST_TOKEN'], note: 'Mattermost bot' },
  dingtalk: { env: ['DINGTALK_WEBHOOK_URL'], note: 'DingTalk outgoing webhook' },
  feishu: { env: ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'], note: 'Feishu/Lark bot' },
  wechat: { env: ['WECHAT_WEBHOOK_URL or WECHAT_CORP_ID'], note: 'WeChat Work webhook' },
  imessage: { env: ['BLUEBUBBLES_URL', 'BLUEBUBBLES_PASSWORD'], note: 'BlueBubbles macOS bridge' },
  email: { env: ['EMAIL_CHANNEL_ENABLED=true'], note: 'Inbound email channel' },
  web: { env: ['WEB_ENABLED=true'], note: 'Browser chat UI' },
  cli: { env: ['(default)'], note: 'Terminal REPL' },
};

export async function runChannelsCommand(action = 'list', channel = ''): Promise<void> {
  if (action === 'setup') {
    const info = CHANNEL_SETUP[channel];
    if (!info) {
      console.log('Usage: carina channels setup <channel>');
      console.log('Channels:', Object.keys(CHANNEL_SETUP).join(', '));
      return;
    }
    console.log(chalk.bold(`\n${channel} setup\n`));
    console.log(info.note);
    console.log('\nRequired env:');
    for (const e of info.env) console.log(`  ${e}`);
    console.log('\nSidecar quick start:');
    if (channel === 'signal') {
      console.log('  docker run -d -p 8080:8080 -e MODE=native -v signal-data:/home/.local/share/signal-cli bbernhard/signal-cli-rest-api');
      console.log('  SIGNAL_API_URL=http://localhost:8080');
    }
    if (channel === 'imessage') {
      console.log('  Install BlueBubbles Server on macOS: https://bluebubbles.app');
      console.log('  BLUEBUBBLES_URL=http://<mac-ip>:1234');
    }
    if (channel === 'matrix') {
      console.log('  Create a bot user on your homeserver and set MATRIX_ACCESS_TOKEN');
    }
    return;
  }

  const active = channelRegistry.listActive();
  console.log(chalk.bold('\nCarina channels\n'));
  for (const [name, info] of Object.entries(CHANNEL_SETUP)) {
    const on = active.includes(name as typeof active[number]);
    const status = on ? chalk.green('active') : chalk.gray('inactive');
    console.log(`  ${name.padEnd(12)} ${status}  ${info.note}`);
    if (!on) {
      console.log(chalk.gray(`               env: ${info.env.join(', ')}`));
    }
  }
  console.log(`\n${active.length} active. Run: carina channels setup <name>\n`);
}
