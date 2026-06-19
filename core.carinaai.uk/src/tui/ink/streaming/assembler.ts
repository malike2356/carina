export type TokenType = 'text' | 'thinking_start' | 'thinking_end' | 'tool_call' | 'tool_done' | 'done';

export interface StreamToken {
  type: TokenType;
  content?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  duration?: number;
}

const THINKING_OPEN = /<(redacted_)?thinking>/i;
const THINKING_CLOSE = /<\/(redacted_)?thinking>/i;
const TOOL_START = /\[using ([^\].\n]+)\.\.\.\]/;

export class StreamAssembler {
  private buffer = '';
  private inThinking = false;

  push(raw: string): StreamToken[] {
    this.buffer += raw;
    const tokens: StreamToken[] = [];

    while (this.buffer.length > 0) {
      if (this.inThinking) {
        const close = this.buffer.match(THINKING_CLOSE);
        if (close && close.index !== undefined) {
          const before = this.buffer.slice(0, close.index);
          if (before) tokens.push({ type: 'text', content: before });
          tokens.push({ type: 'thinking_end' });
          this.inThinking = false;
          this.buffer = this.buffer.slice(close.index + close[0].length);
          continue;
        }
        tokens.push({ type: 'text', content: this.buffer });
        this.buffer = '';
        break;
      }

      const thinkOpen = this.buffer.match(THINKING_OPEN);
      const toolMatch = this.buffer.match(TOOL_START);

      let nextIdx = this.buffer.length;
      let kind: 'think' | 'tool' | null = null;
      let matchLen = 0;

      if (thinkOpen && thinkOpen.index !== undefined && thinkOpen.index < nextIdx) {
        nextIdx = thinkOpen.index;
        kind = 'think';
        matchLen = thinkOpen[0].length;
      }
      if (toolMatch && toolMatch.index !== undefined && toolMatch.index < nextIdx) {
        nextIdx = toolMatch.index;
        kind = 'tool';
        matchLen = toolMatch[0].length;
      }

      if (kind === null) {
        tokens.push({ type: 'text', content: this.buffer });
        this.buffer = '';
        break;
      }

      if (nextIdx > 0) {
        tokens.push({ type: 'text', content: this.buffer.slice(0, nextIdx) });
      }

      if (kind === 'think') {
        tokens.push({ type: 'thinking_start' });
        this.inThinking = true;
        this.buffer = this.buffer.slice(nextIdx + matchLen);
      } else if (kind === 'tool' && toolMatch) {
        tokens.push({ type: 'tool_call', toolName: toolMatch[1]?.trim() ?? 'tool' });
        this.buffer = this.buffer.slice(nextIdx + toolMatch[0].length);
      }
    }

    return tokens;
  }

  flush(): StreamToken[] {
    if (!this.buffer) {
      if (this.inThinking) {
        this.inThinking = false;
        return [{ type: 'thinking_end' }];
      }
      return [{ type: 'done' }];
    }
    const rest = this.push('');
    rest.push({ type: 'done' });
    return rest;
  }
}
