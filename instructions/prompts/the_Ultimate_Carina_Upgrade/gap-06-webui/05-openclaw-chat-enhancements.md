# Web UI Upgrade 05; OpenClaw Chat Enhancements

> **REUSE RULE:** See `../REUSE-RULES.md`. File name references the behavioral source only. All implementation must use Carina's own voice, naming, CLI output, and UI copy. No competitor brand names in any shipped file.


**Source:** OpenClaw (`ui/src/ui/chat/*.ts`, `heartbeat-display.ts`, `context-notice.ts`, `copy-as-markdown.ts`)
**Status:** Missing in Carina web UI
**Effort:** 2 weeks

---

## SPECIFICATION

### 5 Features to Build

| # | Feature | OpenClaw Source | Description |
|---|---------|----------------|-------------|
| 1 | Heartbeat display | `heartbeat-display.ts` | Show when Carina is doing a periodic check-in |
| 2 | Context warnings | `context-notice.ts` | Warn when conversation is approaching context limit |
| 3 | Composer persistence | `composer-persistence.ts` | Draft survives page refresh/navigation |
| 4 | Message export | `copy-as-markdown.ts`, `export.ts` | Export chat as Markdown or download |
| 5 | Deleted messages | `deleted-messages.ts` | Graceful display of deleted messages |

---

## FEATURE 1; HEARTBEAT DISPLAY

### What This Is
Carina periodically checks in on long-running tasks. Show a subtle indicator when this happens so the user knows Carina is still working, not generating a response to a new message.

### Implementation

```tsx
// components/chat/HeartbeatIndicator.tsx
'use client';

import { useEffect, useState } from 'react';
import { useChatStream } from '@/hooks/useChatStream';

export function HeartbeatIndicator() {
  const [heartbeat, setHeartbeat] = useState<{ message: string; timestamp: number } | null>(null);

  useEffect(() => {
    // Listen for heartbeat events from the chat stream
    const sub = chatEvents.on('heartbeat', (data) => {
      setHeartbeat({ message: data.message, timestamp: Date.now() });
      // Auto-dismiss after 3 seconds
      setTimeout(() => setHeartbeat(null), 3000);
    });
    return () => sub.unsubscribe();
  }, []);

  if (!heartbeat) return null;

  return (
    <div className="heartbeat-indicator animate-fade-in">
      <div className="heartbeat-dot" />
      <span className="heartbeat-text">{heartbeat.message}</span>
    </div>
  );
}
```

```css
/* Heartbeat styles */
.heartbeat-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--muted);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--muted-foreground);
  animation: fadeIn 0.3s ease-out;
}

.heartbeat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

**Study reference:** `openclaw/ui/src/ui/chat/heartbeat-display.ts`

---

## FEATURE 2; CONTEXT WARNINGS

### What This Is
When the conversation approaches the model's context window limit, show a subtle warning bar. At 80%: yellow warning. At 95%: red warning suggesting `/clear` or session switch.

### Implementation

```tsx
// components/chat/ContextWarning.tsx
'use client';

import { useEffect, useState } from 'react';

interface ContextWarningProps {
  usedTokens: number;
  maxTokens: number;
  onClearSession?: () => void;
}

export function ContextWarning({ usedTokens, maxTokens, onClearSession }: ContextWarningProps) {
  const percent = (usedTokens / maxTokens) * 100;

  if (percent < 80) return null;

  const isCritical = percent >= 95;

  return (
    <div className={`context-warning ${isCritical ? 'critical' : 'warning'}`}>
      {isCritical ? (
        <>
          <span>WARNING:  Context window {percent.toFixed(0)}% full.</span>
          <span>Carina may lose track of earlier messages.</span>
          <button onClick={onClearSession}>Start new session</button>
        </>
      ) : (
        <>
          <span> Context window {percent.toFixed(0)}% full.</span>
          <span>Consider summarizing or starting a new session soon.</span>
        </>
      )}
    </div>
  );
}
```

```css
.context-warning {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.context-warning.warning {
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.3);
  color: var(--warning);
}

.context-warning.critical {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--destructive);
}

.context-warning button {
  margin-left: auto;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}
```

### Token Tracking

Extract token counts from the chat session:

```typescript
// hooks/useContextBudget.ts
export function useContextBudget(sessionId: string) {
  const [tokens, setTokens] = useState({ used: 0, max: 128000 });

  useEffect(() => {
    // Poll or subscribe to session token count
    const interval = setInterval(async () => {
      const stats = await fetch(`/api/sessions/${sessionId}/tokens`).then(r => r.json());
      setTokens(stats);
    }, 10000);
    return () => clearInterval(interval);
  }, [sessionId]);

  return tokens;
}
```

**Study reference:** `openclaw/ui/src/ui/chat/context-notice.ts`

---

## FEATURE 3; COMPOSER PERSISTENCE

### What This Is
The user's draft message survives page refresh, tab switch, and browser restart. Stored in localStorage.

### Implementation

```typescript
// hooks/useComposerPersistence.ts
'use client';

import { useEffect, useRef } from 'react';

const DRAFT_KEY = 'carina-composer-draft';

export function useComposerPersistence(sessionId: string) {
  const draftKey = `${DRAFT_KEY}-${sessionId}`;
  const restoreOnMount = useRef(true);

  // Restore draft on mount
  const getDraft = (): string => {
    try {
      return localStorage.getItem(draftKey) || '';
    } catch {
      return '';
    }
  };

  // Save draft on change (debounced)
  const saveDraft = (value: string) => {
    try {
      if (value.trim()) {
        localStorage.setItem(draftKey, value);
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {
      // localStorage full or unavailable
    }
  };

  // Clear draft on send
  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
  };

  return { getDraft, saveDraft, clearDraft };
}
```

```tsx
// In ChatInputBar.tsx
export function ChatInputBar({ sessionId }: { sessionId: string }) {
  const { getDraft, saveDraft, clearDraft } = useComposerPersistence(sessionId);
  const [value, setValue] = useState(getDraft);

  const handleSend = () => {
    // ... send message
    setValue('');
    clearDraft();
  };

  const handleChange = (newValue: string) => {
    setValue(newValue);
    // Debounced save
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveDraft(newValue), 500);
  };

  return <textarea value={value} onChange={(e) => handleChange(e.target.value)} />;
}
```

**Study reference:** `openclaw/ui/src/ui/chat/composer-persistence.ts`

---

## FEATURE 4; MESSAGE EXPORT

### What This Is
Export a chat session as Markdown (for sharing) or download as a file. "Copy as Markdown" button on messages.

### Implementation

```typescript
// lib/chat-export.ts

export function chatToMarkdown(messages: ChatMessage[]): string {
  let md = '# Carina Chat Export\n\n';
  md += `**Date:** ${new Date().toLocaleDateString()}\n`;
  md += `**Session:** ${messages[0]?.sessionId || 'Unknown'}\n`;
  md += `**Messages:** ${messages.length}\n\n---\n\n`;

  for (const msg of messages) {
    const role = msg.role === 'user' ? '**You**' : '**Carina**';
    const time = new Date(msg.timestamp).toLocaleTimeString();
    md += `### ${role}; ${time}\n\n${msg.content}\n\n`;

    // Include tool calls
    if (msg.toolCalls?.length) {
      for (const tc of msg.toolCalls) {
        md += `<details>\n<summary> ${tc.name}</summary>\n\n`;
        md += '```\n' + JSON.stringify(tc.result, null, 2) + '\n```\n</details>\n\n';
      }
    }

    md += '---\n\n';
  }

  return md;
}

export function downloadChat(messages: ChatMessage[], filename?: string) {
  const md = chatToMarkdown(messages);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `carina-chat-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function copyAsMarkdown(message: ChatMessage) {
  const md = `**Carina:**\n\n${message.content}`;
  navigator.clipboard.writeText(md);
}
```

```tsx
// In chat/AssistantMessage.tsx; add to message actions
<button onClick={() => copyAsMarkdown(message)}>
  Copy as Markdown
</button>

// In chat header; add export button
<button onClick={() => downloadChat(messages)}>
  Export Chat
</button>
```

**Study reference:** `openclaw/ui/src/ui/chat/copy-as-markdown.ts`, `openclaw/ui/src/ui/chat/export.ts`

---

## FEATURE 5; DELETED MESSAGE HANDLING

### What This Is
When a user deletes a message, show a placeholder instead of removing it entirely (preserves conversation flow). "This message was deleted" with optional restore.

### Implementation

```tsx
// components/chat/DeletedMessage.tsx
export function DeletedMessage({ onRestore }: { onRestore?: () => void }) {
  return (
    <div className="deleted-message">
      <span className="deleted-icon"></span>
      <span className="deleted-text">This message was deleted.</span>
      {onRestore && (
        <button onClick={onRestore} className="deleted-restore">
          Undo
        </button>
      )}
    </div>
  );
}
```

```css
.deleted-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  color: var(--muted-foreground);
  font-style: italic;
  font-size: 0.875rem;
  border: 1px dashed var(--border);
  border-radius: 0.5rem;
  margin: 0.5rem 0;
}

.deleted-restore {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--primary);
  cursor: pointer;
  background: none;
  border: none;
  text-decoration: underline;
}
```

**Study reference:** `openclaw/ui/src/ui/chat/deleted-messages.ts`

---

## IMPLEMENTATION PLAN

### Week 1
```
- Heartbeat indicator (display + event subscription)
- Context warning bar (token tracking + thresholds)
- Composer persistence (localStorage draft)
```

### Week 2
```
- Message export (Markdown conversion + download)
- Copy as Markdown (clipboard integration)
- Deleted message handling (placeholder + undo)
- Integration testing across all chat components
```

---

## REFERENCE FILES

```
OpenClaw:
  openclaw/ui/src/ui/chat/heartbeat-display.ts; heartbeat
  openclaw/ui/src/ui/chat/context-notice.ts; context warnings
  openclaw/ui/src/ui/chat/composer-persistence.ts; draft persistence
  openclaw/ui/src/ui/chat/copy-as-markdown.ts; copy as MD
  openclaw/ui/src/ui/chat/export.ts; chat export
  openclaw/ui/src/ui/chat/deleted-messages.ts; deleted msgs
```