'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ChatInput({ onSend, disabled }: { onSend: (message: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }

  return (
    <form onSubmit={submit} className="flex gap-2 border-t border-border bg-surface p-4">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask Carina to get work done..."
        disabled={disabled}
      />
      <Button type="submit" disabled={disabled || !value.trim()}>Send</Button>
    </form>
  );
}

export function ChatBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          isUser ? 'bg-bubble-user text-text-primary' : 'bg-bubble-assistant text-text-primary'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

type Message = { role: 'user' | 'assistant'; content: string };

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const sessionId = useRef(`session-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  async function send(message: string) {
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setBusy(true);
    setStreaming('');

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId: sessionId.current }),
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: 'Chat failed' }));
      setMessages((prev) => [...prev, { role: 'assistant', content: String(err.error ?? 'Chat failed') }]);
      setBusy(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistant = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data) as string | { error?: string };
          if (typeof parsed === 'string') {
            assistant += parsed;
            setStreaming(assistant);
          } else if (parsed.error) {
            assistant += parsed.error;
            setStreaming(assistant);
          }
        } catch {
          assistant += data;
          setStreaming(assistant);
        }
      }
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: assistant || streaming }]);
    setStreaming('');
    setBusy(false);
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col rounded-xl border border-border bg-surface">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && !streaming && (
          <p className="text-sm text-text-muted">Start a conversation. Add BYOK keys in Settings first.</p>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={`${msg.role}-${i}`} role={msg.role} content={msg.content} />
        ))}
        {streaming && <ChatBubble role="assistant" content={streaming} />}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSend={send} disabled={busy} />
    </div>
  );
}
