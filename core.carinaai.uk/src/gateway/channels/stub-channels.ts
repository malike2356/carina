import { isIrcConfigured } from '../irc.js';

export function shouldExposeChannel(channel: string): boolean {
  if (channel === 'irc') {
    return isIrcConfigured();
  }
  return true;
}
