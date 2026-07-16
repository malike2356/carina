import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from 'ink';
import { MessageList } from './MessageList.js';
import { setActiveSkin } from '../../skins/skin-store.js';

function createStdout(columns: number, rows: number) {
  const stdout = new EventEmitter() as NodeJS.WriteStream & EventEmitter;
  let output = '';
  stdout.columns = columns;
  stdout.rows = rows;
  stdout.isTTY = true;
  stdout.write = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as NodeJS.WriteStream['write'];
  return {
    stdout,
    read: () => output,
  };
}

describe('MessageList', () => {
  it('renders a useful Command Center empty state', () => {
    setActiveSkin('default');
    const terminal = createStdout(120, 30);
    const instance = render(
      <MessageList
        messages={[]}
        isStreaming={false}
        sessionId="session-123456789"
        model="deepseek:deepseek-chat"
        connected
      />,
      { stdout: terminal.stdout, patchConsole: false },
    );

    const frame = terminal.read();
    instance.unmount();

    expect(frame).toContain('Carina Command Center');
    expect(frame).toContain('Runtime ready');
    expect(frame).toContain('/timeline');
    expect(frame).toContain('deepseek:deepseek-chat');
  });

  it('keeps the void skin useful without color', () => {
    setActiveSkin('void');
    const terminal = createStdout(90, 24);
    const instance = render(
      <MessageList
        messages={[]}
        isStreaming={false}
        sessionId="void-session"
        model="local"
        connected={false}
      />,
      { stdout: terminal.stdout, patchConsole: false },
    );

    const frame = terminal.read();
    instance.unmount();

    expect(frame).toContain('Carina Command Center');
    expect(frame).toContain('Transport:');
    expect(frame).toContain('Checking');
  });
});
