import { EventEmitter } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';

export interface IrcClientOptions {
  host: string;
  port: number;
  tls: boolean;
  nick: string;
  username: string;
  realname: string;
  password?: string;
  channels?: string[];
  nickservIdentify?: boolean;
}

export interface IrcIncomingMessage {
  nick: string;
  target: string;
  text: string;
  raw: string;
}

export interface ParsedIrcLine {
  prefix?: string;
  command: string;
  params: string[];
  trailing?: string;
}

export function parseIrcLine(line: string): ParsedIrcLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let rest = trimmed;
  let prefix: string | undefined;
  if (rest.startsWith(':')) {
    const space = rest.indexOf(' ');
    if (space <= 1) return null;
    prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }

  const trailingIndex = rest.indexOf(' :');
  let trailing: string | undefined;
  let commandPart = rest;
  if (trailingIndex >= 0) {
    trailing = rest.slice(trailingIndex + 2);
    commandPart = rest.slice(0, trailingIndex);
  }

  const parts = commandPart.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;

  return {
    prefix,
    command: parts[0] ?? '',
    params: parts.slice(1),
    trailing,
  };
}

export function nickFromPrefix(prefix?: string): string {
  if (!prefix) return '';
  const bang = prefix.indexOf('!');
  return bang >= 0 ? prefix.slice(0, bang) : prefix;
}

export function normalizeIrcChannel(channel: string): string {
  const trimmed = channel.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('#') || trimmed.startsWith('&') ? trimmed : `#${trimmed}`;
}

export class IrcClient extends EventEmitter {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer = '';
  private registered = false;
  private stopping = false;

  constructor(private readonly options: IrcClientOptions) {
    super();
  }

  get connected(): boolean {
    return this.registered && Boolean(this.socket && !this.socket.destroyed);
  }

  connect(): Promise<void> {
    if (this.stopping) {
      return Promise.reject(new Error('IRC client is stopping'));
    }

    return new Promise((resolve, reject) => {
      const onError = (err: Error): void => {
        cleanup();
        reject(err);
      };

      const onConnect = (): void => {
        cleanup();
        if (this.options.password) {
          this.writeRaw(`PASS ${this.options.password}`);
        }
        this.writeRaw(`NICK ${this.options.nick}`);
        this.writeRaw(`USER ${this.options.username} 0 * :${this.options.realname}`);
      };

      const cleanup = (): void => {
        this.socket?.off('error', onError);
        this.socket?.off('connect', onConnect);
        this.socket?.off('secureConnect', onConnect);
      };

      if (this.options.tls) {
        this.socket = tls.connect({
          host: this.options.host,
          port: this.options.port,
          servername: this.options.host,
        });
        this.socket.once('secureConnect', onConnect);
      } else {
        this.socket = net.connect({
          host: this.options.host,
          port: this.options.port,
        });
        this.socket.once('connect', onConnect);
      }

      this.socket.on('error', onError);
      this.socket.on('data', (chunk) => this.handleData(chunk.toString('utf8')));
      this.socket.on('close', () => {
        this.registered = false;
        this.emit('close');
      });

      const welcomeHandler = (): void => {
        clearTimeout(timeout);
        this.off('registered', welcomeHandler);
        resolve();
      };
      this.once('registered', welcomeHandler);
      const timeout = setTimeout(() => {
        if (!this.registered) {
          reject(new Error(`IRC registration timed out for ${this.options.host}`));
        }
      }, 30_000);
      timeout.unref();
    });
  }

  stop(): void {
    this.stopping = true;
    this.socket?.destroy();
    this.socket = null;
    this.registered = false;
  }

  join(channel: string): void {
    this.writeRaw(`JOIN ${normalizeIrcChannel(channel)}`);
  }

  say(target: string, message: string): void {
    const sanitized = message.replace(/[\r\n]+/g, ' ').trim();
    if (!sanitized) return;
    this.writeRaw(`PRIVMSG ${target} :${sanitized}`);
  }

  private writeRaw(line: string): void {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('IRC socket is not connected');
    }
    this.socket.write(`${line}\r\n`, 'utf8');
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf('\r\n');
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 2);
      this.handleLine(line);
      newline = this.buffer.indexOf('\r\n');
    }
  }

  private handleLine(line: string): void {
    const parsed = parseIrcLine(line);
    if (!parsed) return;

    const { command, params, trailing, prefix } = parsed;
    const numeric = Number(command);
    if (Number.isInteger(numeric)) {
      if (numeric === 1 || numeric === 376) {
        this.onRegistered();
      }
      if (numeric === 433 && params[1]) {
        this.writeRaw(`NICK ${params[1]}_`);
      }
      return;
    }

    const upper = command.toUpperCase();
    if (upper === 'PING') {
      const token = trailing ?? params.join(' ');
      this.writeRaw(token ? `PONG :${token}` : 'PONG');
      return;
    }

    if (upper === 'PRIVMSG' && params[0]) {
      const text = trailing ?? '';
      const nick = nickFromPrefix(prefix);
      if (!nick || !text) return;
      const message: IrcIncomingMessage = {
        nick,
        target: params[0],
        text,
        raw: line,
      };
      this.emit('message', message);
    }
  }

  private onRegistered(): void {
    if (this.registered) return;
    this.registered = true;
    if (this.options.nickservIdentify && this.options.password) {
      this.say('NickServ', `IDENTIFY ${this.options.password}`);
    }
    for (const channel of this.options.channels ?? []) {
      this.join(channel);
    }
    this.emit('registered');
  }
}
