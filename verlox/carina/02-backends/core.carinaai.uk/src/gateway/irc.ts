import { config } from '../config/index.js';

export function isIrcConfigured(): boolean {
  return Boolean(
    config.irc.enabled &&
    config.irc.server.trim() &&
    config.irc.nick.trim(),
  );
}

export function isIrcLiveEnabled(): boolean {
  return isIrcConfigured() && config.irc.live;
}

export function logIrcStatus(): void {
  if (!isIrcConfigured()) {
    console.warn(
      'IRC gateway skipped: set IRC_ENABLED=true, IRC_SERVER, and IRC_NICK',
    );
    return;
  }
  if (isIrcLiveEnabled()) {
    console.log(`IRC gateway: live client to ${config.irc.server} as ${config.irc.nick}`);
  } else {
    console.log('IRC gateway: webhook-only (POST /webhooks/irc); IRC_LIVE=false');
  }
}
