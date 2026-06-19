import chalk from 'chalk';
import { channelRegistry } from '../../gateway/channels/channel-registry.js';
import { getChannelStatusReports, getChannelPolicyFlags, type ChannelHealthState } from '../../gateway/channels/channel-status.js';
import {
  approveDmPeer,
  listDmAudit,
  listDmPeers,
  rejectDmPeer,
  revokeDmPeer,
  rotateDmPeerToken,
} from '../../gateway/channels/dm-pairing.js';
import {
  handoffThreadOwnership,
  listOwnershipAudit,
  listThreadOwnership,
  releaseThreadOwnership,
} from '../../gateway/channels/thread-ownership.js';
import {
  lookupDirectoryPeer,
  registerDirectoryPeer,
  searchDirectory,
} from '../../gateway/channels/directory.js';
import { shouldExposeChannel } from '../../gateway/channels/stub-channels.js';
import type { ChannelName } from '../../gateway/channels/channel-adapter.interface.js';

export const CHANNEL_SETUP: Record<string, { env: string[]; note: string; webhook?: string }> = {
  telegram: { env: ['TELEGRAM_BOT_TOKEN'], note: 'Native long-polling bot' },
  discord: { env: ['DISCORD_BOT_TOKEN'], note: 'Native gateway' },
  slack: { env: ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'], note: 'Socket mode' },
  whatsapp: {
    env: ['BAILEYS_WHATSAPP_ENABLED=true', 'CARINA_WHATSAPP_SELF_BRIDGE=true (optional)'],
    note: 'Baileys live or Twilio webhook; self-bridge is operator opt-in',
  },
  sms: { env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'], note: 'Twilio SMS', webhook: '/webhooks/sms' },
  signal: { env: ['SIGNAL_API_URL', 'SIGNAL_API_KEY', 'SIGNAL_PHONE_NUMBER'], note: 'signal-cli-rest-api sidecar + poll', webhook: '/webhooks/signal' },
  matrix: { env: ['MATRIX_HOMESERVER_URL', 'MATRIX_ACCESS_TOKEN', 'MATRIX_USER_ID'], note: 'Matrix bot with /sync listener', webhook: '/webhooks/matrix' },
  mattermost: { env: ['MATTERMOST_URL', 'MATTERMOST_TOKEN'], note: 'Mattermost outgoing webhook in + bot token out', webhook: '/webhooks/mattermost' },
  irc: { env: ['IRC_ENABLED=true', 'IRC_SERVER', 'IRC_NICK'], note: 'IRC live TLS client (Libera, OFTC, etc.) or webhook fallback', webhook: '/webhooks/irc' },
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

function stateColor(state: ChannelHealthState): (text: string) => string {
  switch (state) {
    case 'connected': return chalk.green;
    case 'configured':
    case 'partial': return chalk.yellow;
    case 'error': return chalk.red;
    case 'disabled':
    case 'unsupported':
    default: return chalk.gray;
  }
}

export async function runChannelsCommand(action = 'list', ...rest: string[]): Promise<void> {
  const json = rest.includes('--json');
  const args = rest.filter((a) => a !== '--json');
  if (action === 'status') {
    const reports = getChannelStatusReports();
    if (json) {
      console.log(JSON.stringify(reports, null, 2));
      return;
    }
    console.log(chalk.bold('\nChannel status\n'));
    for (const r of reports) {
      const color = stateColor(r.state);
      const line = `${String(r.channel).padEnd(14)} ${color(r.state.padEnd(12))} ${r.active ? 'active' : 'inactive'}`;
      console.log(line + (r.transport ? chalk.gray(`  (${r.transport})`) : ''));
      if (r.reason) console.log(chalk.gray(`               ${r.reason}`));
    }
    console.log('\nFlags: CARINA_THREAD_OWNERSHIP, CARINA_CHANNEL_DM_PAIRING, CARINA_CHANNEL_PEER_SCOPING, CARINA_WHATSAPP_SELF_BRIDGE');
    const flags = getChannelPolicyFlags();
    console.log(chalk.gray(`  threadOwnership=${flags.threadOwnership}  dmPairing=${flags.dmPairing}  peerScoping=${flags.peerScoping}  whatsappSelfBridge=${flags.whatsappSelfBridge}`));
    const configuredMessengers = reports.filter((r) =>
      ['telegram', 'discord', 'slack', 'whatsapp', 'signal', 'matrix'].includes(r.channel)
      && r.state !== 'disabled');
    if (configuredMessengers.length > 0 && !flags.dmPairing) {
      console.log(chalk.yellow('\n  WARNING: Messenger channels configured but DM pairing is off.'));
      console.log(chalk.yellow('  Set CARINA_CHANNEL_DM_PAIRING=true or rerun carina onboard for a messenger channel.'));
    }
    if (flags.peerScoping) {
      console.log(chalk.gray('  peer scoping: session keys use channel:peer (and :t:thread when thread ownership is on)'));
    }
    if (flags.dmPairing) {
      console.log(chalk.gray('  DM pairing: unknown direct peers are held pending until `carina channels dm approve <channel> <peerId>`'));
    }
    console.log('');
    return;
  }

  if (action === 'dm') {
    await runDmCommand(args[0] ?? '', args[1] ?? '', args[2] ?? '');
    return;
  }

  if (action === 'threads') {
    runThreadsCommand(args[0] ?? '', args[1] ?? '', args[2] ?? '');
    return;
  }

  if (action === 'directory') {
    await runDirectoryCommand(args[0] ?? '', args[1] ?? '', args[2] ?? '');
    return;
  }

  if (action === 'setup') {
    const channel = args[0] ?? '';
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
    if (channel === 'whatsapp') {
      console.log('  BAILEYS_WHATSAPP_ENABLED=true');
      console.log('  Optional self-chat bridge: CARINA_WHATSAPP_SELF_BRIDGE=true (audited via channel status)');
    }
    if (channel === 'irc') {
      console.log('  Set IRC_ENABLED=true, IRC_SERVER, IRC_NICK for live client.');
      console.log('  Optional: IRC_CHANNELS=#room1,#room2, IRC_PASSWORD, IRC_TLS=true');
      console.log('  Webhook fallback: POST /webhooks/irc when IRC_LIVE=false');
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
    if (!shouldExposeChannel(name)) continue;
    const on = active.includes(name as typeof active[number]);
    const status = on ? chalk.green('active') : chalk.gray('inactive');
    console.log(`  ${name.padEnd(14)} ${status}  ${info.note}`);
    if (!on) {
      console.log(chalk.gray(`               env: ${info.env.join(', ')}`));
    } else if (info.webhook) {
      console.log(chalk.gray(`               ${info.webhook}`));
    }
  }
  console.log(`\n${active.length} active. Run: carina channels status | setup <name>\n`);
}

async function runDmCommand(sub: string, channel: string, peerId?: string): Promise<void> {
  if (sub === 'audit') {
    for (const row of listDmAudit(30)) {
      console.log(`${row.at}  ${row.action}  ${row.channel}:${row.peerId}${row.detail ? `  ${row.detail}` : ''}`);
    }
    return;
  }
  if (sub === 'list') {
    const peers = listDmPeers(channel as ChannelName | undefined);
    if (!peers.length) {
      console.log('No DM peers.');
      return;
    }
    for (const p of peers) {
      console.log(`${p.channel}:${p.peerId}  ${p.status}${p.label ? `  (${p.label})` : ''}`);
    }
    return;
  }
  if (!channel || !peerId) {
    console.log('Usage: carina channels dm <list|approve|reject|revoke|rotate|audit> [channel] [peerId]');
    return;
  }
  const ch = channel as ChannelName;
  if (sub === 'approve') {
    const r = approveDmPeer(ch, peerId);
    console.log(r ? chalk.green(`Approved ${ch}:${peerId}`) : chalk.red('Peer not found'));
    return;
  }
  if (sub === 'reject') {
    const r = rejectDmPeer(ch, peerId);
    console.log(r ? chalk.yellow(`Rejected ${ch}:${peerId}`) : chalk.red('Peer not found'));
    return;
  }
  if (sub === 'revoke') {
    const r = revokeDmPeer(ch, peerId);
    console.log(r ? chalk.yellow(`Revoked ${ch}:${peerId}`) : chalk.red('Peer not found'));
    return;
  }
  if (sub === 'rotate') {
    const token = rotateDmPeerToken(ch, peerId);
    console.log(token ? `New token: ${token}` : chalk.red('Approved peer not found'));
    return;
  }
  console.log('Usage: carina channels dm <list|approve|reject|revoke|rotate|audit> [channel] [peerId]');
}

function runThreadsCommand(sub: string, keyOrAgent: string, toAgent?: string): void {
  if (sub === 'audit') {
    for (const row of listOwnershipAudit(30)) {
      console.log(`${row.at}  ${row.action}  ${row.key}${row.detail ? `  ${row.detail}` : ''}`);
    }
    return;
  }
  if (sub === 'list') {
    const rows = listThreadOwnership();
    if (!rows.length) {
      console.log('No thread ownership records.');
      return;
    }
    for (const t of rows) {
      console.log(`${t.key}  agent=${t.agentId}  instance=${t.instanceId}`);
    }
    return;
  }
  if (sub === 'handoff' && keyOrAgent && toAgent) {
    const r = handoffThreadOwnership(keyOrAgent, toAgent);
    console.log(r ? chalk.green(`Handed off ${keyOrAgent} -> ${toAgent}`) : chalk.red('Thread key not found'));
    return;
  }
  if (sub === 'release' && keyOrAgent) {
    const ok = releaseThreadOwnership(keyOrAgent);
    console.log(ok ? chalk.green(`Released ${keyOrAgent}`) : chalk.red('Thread key not found'));
    return;
  }
  console.log('Usage: carina channels threads <list|handoff|release|audit> [key] [toAgent]');
}

async function runDirectoryCommand(sub: string, channel: string, query?: string): Promise<void> {
  if (sub === 'register' && channel && query) {
    const parts = query.split('|');
    registerDirectoryPeer({
      channel: channel as ChannelName,
      peerId: parts[0] ?? query,
      displayName: parts[1] ?? parts[0] ?? query,
      source: 'manual',
      group: parts[2] === 'group',
    });
    console.log(chalk.green(`Registered ${channel}:${parts[0]}`));
    return;
  }
  if (sub === 'lookup' && channel && query) {
    const hit = await lookupDirectoryPeer(channel as ChannelName, query);
    console.log(hit ? JSON.stringify(hit, null, 2) : 'Not found');
    return;
  }
  if (sub === 'search' && channel && query) {
    const hits = await searchDirectory(channel as ChannelName, query);
    console.log(JSON.stringify(hits, null, 2));
    return;
  }
  console.log('Usage: carina channels directory <lookup|search|register> <channel> <peerId|query>');
}
