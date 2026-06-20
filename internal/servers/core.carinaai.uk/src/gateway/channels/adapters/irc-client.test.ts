import { describe, expect, it } from 'vitest';
import {
  nickFromPrefix,
  normalizeIrcChannel,
  parseIrcLine,
} from './irc-client.js';

describe('irc-client parsing', () => {
  it('parses PRIVMSG lines', () => {
    const parsed = parseIrcLine(':alice!~alice@host PRIVMSG #carina :hello @carina');
    expect(parsed?.command).toBe('PRIVMSG');
    expect(parsed?.params).toEqual(['#carina']);
    expect(parsed?.trailing).toBe('hello @carina');
    expect(nickFromPrefix(parsed?.prefix)).toBe('alice');
  });

  it('parses PING with trailing token', () => {
    const parsed = parseIrcLine('PING :irc.example.com');
    expect(parsed?.command).toBe('PING');
    expect(parsed?.trailing).toBe('irc.example.com');
  });

  it('normalizes channel names', () => {
    expect(normalizeIrcChannel('carina')).toBe('#carina');
    expect(normalizeIrcChannel('#carina')).toBe('#carina');
  });
});
