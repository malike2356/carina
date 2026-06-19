import { useState, useCallback, useRef } from 'react';
import { StreamAssembler } from '../streaming/assembler.js';
import { countTokens } from '../../../brain/token-counter.js';

export type ThinkingPart = {
  kind: 'thinking';
  content: string;
  complete: boolean;
};

export type ToolPart = {
  kind: 'tool';
  toolName: string;
  args?: unknown;
  result?: unknown;
  duration?: number;
  isRunning: boolean;
  isError?: boolean;
};

export type TextPart = {
  kind: 'text';
  content: string;
};

export type MessagePart = TextPart | ThinkingPart | ToolPart;

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  dimmed?: boolean;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const assemblerRef = useRef(new StreamAssembler());
  const streamStartRef = useRef<number>(0);

  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => {
      const dimmed = prev.map((m) =>
        m.role === 'user' ? { ...m, dimmed: true } : m,
      );
      return [
        ...dimmed,
        { id: newId(), role: 'user', parts: [{ kind: 'text', content: text }] },
      ];
    });
    assemblerRef.current = new StreamAssembler();
    streamStartRef.current = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'assistant', parts: [] },
    ]);
  }, []);

  const applyTokens = useCallback((tokens: ReturnType<StreamAssembler['push']>) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      const last = copy[lastIdx];
      if (last.role !== 'assistant') return prev;

      const parts = [...last.parts];
      for (const tok of tokens) {
        if (tok.type === 'text' && tok.content) {
          const tail = parts[parts.length - 1];
          if (tail?.kind === 'text') {
            parts[parts.length - 1] = { kind: 'text', content: tail.content + tok.content };
          } else if (tail?.kind === 'thinking' && !tail.complete) {
            parts[parts.length - 1] = { ...tail, content: tail.content + tok.content };
          } else {
            parts.push({ kind: 'text', content: tok.content });
          }
        } else if (tok.type === 'thinking_start') {
          parts.push({ kind: 'thinking', content: '', complete: false });
        } else if (tok.type === 'thinking_end') {
          const idx = parts.findIndex((p) => p.kind === 'thinking' && !p.complete);
          if (idx >= 0) {
            parts[idx] = { ...(parts[idx] as ThinkingPart), complete: true };
          }
        } else if (tok.type === 'tool_call' && tok.toolName) {
          parts.push({
            kind: 'tool',
            toolName: tok.toolName,
            isRunning: true,
          });
        } else if (tok.type === 'tool_done' && tok.toolName) {
          const idx = parts.findIndex((p) => p.kind === 'tool' && p.toolName === tok.toolName && p.isRunning);
          if (idx >= 0) {
            parts[idx] = {
              ...(parts[idx] as ToolPart),
              isRunning: false,
              result: tok.toolResult,
              duration: tok.duration ?? Date.now() - streamStartRef.current,
            };
          }
        }
      }
      copy[lastIdx] = { ...last, parts };
      return copy;
    });
  }, []);

  const appendToken = useCallback((raw: string) => {
    const tokens = assemblerRef.current.push(raw);
    if (tokens.length > 0) applyTokens(tokens);
  }, [applyTokens]);

  const finalizeAssistant = useCallback(() => {
    const tokens = assemblerRef.current.flush();
    if (tokens.length > 0) applyTokens(tokens);
    setMessages((prev) => {
      const copy = [...prev];
      for (let i = 0; i < copy.length; i++) {
        const msg = copy[i];
        if (msg.role !== 'assistant') continue;
        const parts = msg.parts.map((p) => {
          if (p.kind === 'thinking' && !p.complete) return { ...p, complete: true };
          if (p.kind === 'tool' && p.isRunning) {
            return { ...p, isRunning: false, duration: Date.now() - streamStartRef.current };
          }
          return p;
        });
        copy[i] = { ...msg, parts };
      }
      return copy;
    });
  }, [applyTokens]);

  const clearDisplay = useCallback(() => {
    setMessages([]);
    assemblerRef.current = new StreamAssembler();
  }, []);

  const addAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'assistant', parts: [{ kind: 'text', content: text }] },
    ]);
  }, []);

  const tokenCount = messages.reduce((sum, m) => {
    const text = m.parts
      .map((p) => (p.kind === 'text' || p.kind === 'thinking' ? p.content : ''))
      .join('');
    return sum + countTokens(text).tokens;
  }, 0);

  return {
    messages,
    addUserMessage,
    appendToken,
    finalizeAssistant,
    clearDisplay,
    addAssistantMessage,
    tokenCount,
  };
}
