import chalk from 'chalk';
import { channelRegistry } from '../../gateway/channels/channel-registry.js';

export const CHANNEL_SETUP: Record<string, { env: string[]; note: string; webhook?: string }> = {
  telegram: { env: ['TELEGRAM_BOT_TOKEN'], note: 'Native long-polling bot' },
  discord: { env: ['DISCORD_BOT_TOKEN'], note: 'Native gateway' },
  slack: { env: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'], note: 'Socket mode' },
  whatsapp: { env: ['BAILEYS_WHATSAPP_ENABLED=true', 'or TWILIO_*'], note: 'Baileys live or Twilio webhook' },
  sms: { env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'], note: 'Twilio SMS', webhook: '/webhooks/sms' },
  signal: { env: ['SIGNAL_API_URL', 'SIGNAL_API_KEY', 'SIGNAL_PHONE_NUMBER'], note: 'signal-cli-rest-api sidecar + poll', webhook: '/webhooks/signal' },
  matrix: { env: ['MATRIX_HOMESERVER_URL', 'MATRIX_ACCESS_TOKEN', 'MATRIX_USER_ID'], note: 'Matrix bot with /sync listener', webhook: '/webhooks/matrix' },
  mattermost: { env: ['MATTERMOST_URL', 'MATTERMOST_TOKEN'], note: 'Mattermost outgoing webhook in + bot token out', webhook: '/webhooks/mattermost' },
  dingtalk: { env: ['DINGTALK_WEBHOOK_URL', 'DINGTALK_SECRET'], note: 'DingTalk bot webhook', webhook: '/webhooks/dingtalk' },
  feishu: { env: ['FEISHU_APP_ID', 'FEISHU_APP_SECRET'], note: 'Feishu/Lark bot', webhook: '/webhooks/feishu' },
  wechat: { env: ['WECHAT_CORP_ID', 'WECHAT_CORP_SECRET', 'WECHAT_AGENT_ID', 'or WECHAT_WEBHOOK_URL'], note: 'WeCom (WeChat Work)', webhook: '/webhooks/wechat' },
  imessage: { env: ['BLUEBUBBLES_URL', 'BLUEBUBBLES_PASSWORD'], note: 'BlueBubbles macOS bridge', webhook: '/webhooks/imessage' },
  email: { env: ['EMAIL_CHANNEL_ENABLED=true', 'EMAIL_CHANNEL_WEBHOOK_SECRET'], note: 'Inbound email webhook', webhook: '/webhooks/email' },
  homeassistant: { env: ['HA_CHANNEL_ENABLED=true', 'HOMEASSISTANT_URL', 'HOMEASSISTANT_TOKEN', 'HA_CHANNEL_NOTIFY_SERVICE'], note: 'HA automation webhook in, notify out', webhook: '/webhooks/homeassistant' },
  api: { env: ['API_CHANNEL_ENABLED=true', 'API_CHANNEL_API_KEY'], note: 'HTTP API server channel', webhook: '/webhooks/api/message' },
  webhooks: { env: ['WEBHOOK_CHANNEL_ENABLED=true', 'WEBHOOK_CHANNEL_SECRET'], note: 'Generic webhook with callback_url reply', webhook: '/webhooks/webhooks' },
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
    if (info.webhook) {
      console.log(`\nInbound webhook: POST ${info.webhook}`);
    }
    console.log('\nSidecar quick start:');
    if (channel === 'signal') {
      console.log('  docker run -d -p 8080:8080 -e MODE=native -v signal-data:/home/.local/share/signal-cli bbernhard/signal-cli-rest-api');
      console.log('  SIGNAL_API_URL=http://localhost:8080');
      console.log('  SIGNAL_PHONE_NUMBER=+1...');
    }
    if (channel === 'imessage') {
      console.log('  Install BlueBubbles Server on macOS: https://bluebubbles.app');
      console.log('  BLUEBUBBLES_URL=http://<mac-ip>:1234');
    }
    if (channel === 'matrix') {
      console.log('  Create a bot user on your homeserver and set MATRIX_ACCESS_TOKEN');
      console.log('  Or POST events to /webhooks/matrix from an appservice');
    }
    if (channel === 'homeassistant') {
      console.log('  automation: webhook to POST /webhooks/homeassistant with { text, user_id, conversation_id }');
      console.log('  Set HA_CHANNEL_NOTIFY_SERVICE=notify.mobile_app (optional)');
    }
    if (channel === 'api') {
      console.log('  curl -X POST http://localhost:3000/webhooks/api/message \\');
      console.log('    -H "Authorization: Bearer $API_CHANNEL_API_KEY" \\');
      console.log('    -d \'{"user_id":"u1","message":"hello"}\'');
    }
    if (channel === 'webhooks') {
      console.log('  curl -X POST http://localhost:3000/webhooks/webhooks \\');
      console.log('    -d \'{"message":"hi","callback_url":"https://example.com/hook"}\'');
    }
    if (channel === 'email') {
      console.log('  Point inbound email parser (Resend, Mailgun, etc.) at POST /webhooks/email');
    }
    return;
  }

  const active = channelRegistry.listActive();
  console.log(chalk.bold('\nCarina channels\n'));
  for (const [name, info] of Object.entries(CHANNEL_SETUP)) {
    const on = active.includes(name as typeof active[number]);
    const status = on ? chalk.green('active') : chalk.gray('inactive');
    console.log(`  ${name.padEnd(14)} ${status}  ${info.note}`);
    if (!on) {
      console.log(chalk.gray(`               env: ${info.env.join(', ')}`));
    } else if (info.webhook) {
      console.log(chalk.gray(`               ${info.webhook}`));
    }
  }
  console.log(`\n${active.length} active. Run: carina channels setup <name>\n`);
}
