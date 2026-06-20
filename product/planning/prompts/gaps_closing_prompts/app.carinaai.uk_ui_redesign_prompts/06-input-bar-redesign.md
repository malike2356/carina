# Prompt 06 - Input Bar Redesign

## Objective

Replace the basic textarea + Send button with a full-featured input bar matching Odysseus quality: floating card style, model selector, Agent/Chat mode toggle, attachment expand panel, context chip display, web search toggle, and keyboard handling. This is the most-used element in the app and must be excellent.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-05 complete. The `ChatInputBar` placeholder in `ChatView.tsx` gets replaced here.

---

## Step 1 - Create ModelSelectorPopover Component

Create `src/components/chat/ModelSelectorPopover.tsx`:

Users can switch the active model mid-session. The list comes from the user's connected providers (BYOK keys). We call `/api/models` to get available models.

```tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Model {
  provider: string;
  model: string;
  label: string;
}

interface ModelSelectorPopoverProps {
  selectedProvider: string;
  selectedModel: string;
  onSelect: (provider: string, model: string, label: string) => void;
}

export function ModelSelectorPopover({ selectedProvider, selectedModel, onSelect }: ModelSelectorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((d) => { if (d.data) setModels(d.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const filtered = models.filter(
    (m) =>
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase()),
  );

  const currentLabel = models.find((m) => m.provider === selectedProvider && m.model === selectedModel)?.label
    ?? (selectedProvider ? `${selectedProvider} / ${selectedModel}` : 'Select model');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors border border-transparent hover:border-border"
      >
        <span className="max-w-[140px] truncate">{currentLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 z-50 w-64 rounded-lg border border-border bg-overlay shadow-xl">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full rounded-md bg-elevated border border-border px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-text-muted">
                {models.length === 0
                  ? 'No keys configured. Add keys in Settings.'
                  : 'No models match.'}
              </p>
            )}
            {filtered.map((m) => (
              <button
                key={`${m.provider}-${m.model}`}
                type="button"
                onClick={() => { onSelect(m.provider, m.model, m.label); setOpen(false); setSearch(''); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-elevated transition-colors"
              >
                <Check
                  className={cn('h-3 w-3 shrink-0', m.provider === selectedProvider && m.model === selectedModel ? 'text-accent' : 'opacity-0')}
                />
                <div>
                  <p className="text-text-primary">{m.label}</p>
                  <p className="text-text-muted">{m.provider}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Step 2 - Create /api/models Route

Create `src/app/api/models/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';

const PROVIDER_MODELS: Record<string, Array<{ model: string; label: string }>> = {
  deepseek: [
    { model: 'deepseek-chat', label: 'DeepSeek Chat' },
    { model: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  ],
  openai: [
    { model: 'gpt-4o', label: 'GPT-4o' },
    { model: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { model: 'o3-mini', label: 'o3 Mini' },
  ],
  groq: [
    { model: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
    { model: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
    { model: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  ],
  openrouter: [
    { model: 'deepseek/deepseek-chat', label: 'DeepSeek via OpenRouter' },
    { model: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { model: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5' },
  ],
  together: [
    { model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Turbo' },
  ],
  mistral: [
    { model: 'mistral-small-latest', label: 'Mistral Small' },
    { model: 'mistral-large-latest', label: 'Mistral Large' },
  ],
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  const data = keys.flatMap((k) =>
    (PROVIDER_MODELS[k.provider] ?? []).map((m) => ({
      provider: k.provider,
      model: m.model,
      label: m.label,
    })),
  );
  return NextResponse.json({ data });
}
```

---

## Step 3 - Create AttachPanel Component

Create `src/components/chat/AttachPanel.tsx`:

A small popover that appears when the expand chevron is clicked, offering attachment options:

```tsx
'use client';
import { useRef, useEffect } from 'react';
import { Paperclip, FileText, Folder, Wand2 } from 'lucide-react';

interface AttachPanelProps {
  onClose: () => void;
  onAttachFiles: () => void;
  onAttachNote: () => void;
  onInjectPrompt: () => void;
}

export function AttachPanel({ onClose, onAttachFiles, onAttachNote, onInjectPrompt }: AttachPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [onClose]);

  const options = [
    { icon: <Paperclip className="h-3.5 w-3.5" />, label: 'Attach files', action: onAttachFiles },
    { icon: <FileText className="h-3.5 w-3.5" />, label: 'Note as context', action: onAttachNote },
    { icon: <Wand2 className="h-3.5 w-3.5" />, label: 'Inject prompt', action: onInjectPrompt },
  ];

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 mb-2 z-50 rounded-lg border border-border bg-overlay shadow-xl w-44"
    >
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => { opt.action(); onClose(); }}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
        >
          <span className="text-accent">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

---

## Step 4 - Create ContextChips Component

Create `src/components/chat/ContextChips.tsx`:

Shows pinned notes/documents above the input:

```tsx
import { X, FileText, StickyNote } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';

interface ContextPin {
  id: string;
  label: string;
  pinType: 'note' | 'document' | 'text';
}

export function ContextChips({ pins, onRemove }: {
  pins: ContextPin[];
  onRemove: (id: string) => void;
}) {
  if (pins.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 pb-2">
      {pins.map((pin) => (
        <div
          key={pin.id}
          className="flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 text-xs text-text-secondary"
        >
          {pin.pinType === 'note'
            ? <StickyNote className="h-3 w-3 text-accent" />
            : <FileText className="h-3 w-3 text-accent" />}
          <span>{pin.label}</span>
          <IconButton label={`Remove ${pin.label}`} size="sm" onClick={() => onRemove(pin.id)}>
            <X className="h-2.5 w-2.5" />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
```

---

## Step 5 - Create the Full ChatInputBar Component

Replace the placeholder `ChatInputBar` inside `ChatView.tsx` by extracting it to its own file.

Create `src/components/chat/ChatInputBar.tsx`:

```tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronUp, Search, Terminal, Send } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { ModelSelectorPopover } from './ModelSelectorPopover';
import { AttachPanel } from './AttachPanel';
import { ContextChips } from './ContextChips';
import { cn } from '@/lib/utils';

interface ContextPin {
  id: string;
  label: string;
  pinType: 'note' | 'document' | 'text';
  content: string;
}

interface ChatInputBarProps {
  onSend: (message: string, opts: { mode: 'chat' | 'agent'; provider: string; model: string; contextPins: ContextPin[] }) => void;
  disabled: boolean;
  sessionId: string;
  contextPins: ContextPin[];
  onAddContextPin: (pin: ContextPin) => void;
  onRemoveContextPin: (id: string) => void;
}

export function ChatInputBar({
  onSend,
  disabled,
  sessionId,
  contextPins,
  onAddContextPin,
  onRemoveContextPin,
}: ChatInputBarProps) {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoGrow() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  useEffect(() => { autoGrow(); }, [value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, { mode, provider, model, contextPins });
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="relative">
      {/* Context chips above input */}
      <ContextChips pins={contextPins} onRemove={onRemoveContextPin} />

      {/* Main input card */}
      <div className={cn(
        'rounded-xl border border-border bg-elevated transition-colors',
        'focus-within:border-border-focus',
        disabled && 'opacity-60',
      )}>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); }}
          onKeyDown={onKeyDown}
          placeholder={mode === 'agent' ? 'Give Carina a task to complete...' : 'Message Carina...'}
          disabled={disabled}
          rows={1}
          className="block w-full resize-none bg-transparent px-4 pt-3 pb-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
          style={{ maxHeight: 160 }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-2 pb-2">
          {/* Left tools */}
          <div className="flex items-center gap-0.5">
            {/* Attach panel toggle */}
            <div className="relative">
              <Tooltip text="Attach / expand" side="top">
                <IconButton
                  label="Expand options"
                  onClick={() => setShowAttach(!showAttach)}
                >
                  <ChevronUp className={cn('h-4 w-4 transition-transform', showAttach && 'rotate-180')} />
                </IconButton>
              </Tooltip>
              {showAttach && (
                <AttachPanel
                  onClose={() => setShowAttach(false)}
                  onAttachFiles={() => {
                    // File input trigger - placeholder for Prompt 09
                  }}
                  onAttachNote={() => {
                    document.dispatchEvent(new CustomEvent('open-panel', { detail: 'notes' }));
                    setShowAttach(false);
                  }}
                  onInjectPrompt={() => {
                    // Prompt library - future feature
                    setShowAttach(false);
                  }}
                />
              )}
            </div>

            {/* Web search toggle */}
            <Tooltip text={webSearch ? 'Web search on' : 'Web search off'} side="top">
              <IconButton
                label={webSearch ? 'Disable web search' : 'Enable web search'}
                onClick={() => setWebSearch(!webSearch)}
                className={webSearch ? 'text-accent' : ''}
              >
                <Search className="h-4 w-4" />
              </IconButton>
            </Tooltip>

            {/* Shell toggle - shown in agent mode */}
            {mode === 'agent' && (
              <Tooltip text="Shell tools" side="top">
                <IconButton label="Shell tools">
                  <Terminal className="h-4 w-4" />
                </IconButton>
              </Tooltip>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            {/* Model selector */}
            <ModelSelectorPopover
              selectedProvider={provider}
              selectedModel={model}
              onSelect={(p, m) => { setProvider(p); setModel(m); }}
            />

            {/* Mode toggle */}
            <Tooltip text={mode === 'agent' ? 'Switch to Chat mode' : 'Switch to Agent mode'} side="top">
              <button
                type="button"
                onClick={() => setMode(mode === 'chat' ? 'agent' : 'chat')}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  mode === 'agent'
                    ? 'bg-accent-dim text-accent border border-accent/30'
                    : 'bg-elevated text-text-secondary hover:text-text-primary border border-border',
                )}
              >
                {mode === 'agent' ? 'Agent' : 'Chat'}
              </button>
            </Tooltip>

            {/* Send button */}
            <Tooltip text="Send (Enter)" side="top">
              <button
                type="button"
                onClick={submit}
                disabled={disabled || !value.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-black hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="mt-1 text-center text-[10px] text-text-muted">
        Enter to send - Shift+Enter for new line
      </p>
    </div>
  );
}
```

---

## Step 6 - Update ChatView to Use New InputBar

In `src/components/chat/ChatView.tsx`:

1. Import `ChatInputBar`, `ContextChips` types
2. Add `contextPins` state: `const [contextPins, setContextPins] = useState<ContextPin[]>([]);`
3. Replace the placeholder `ChatInputBar` with the new component:

```tsx
<ChatInputBar
  onSend={(message, opts) => {
    setProvider(opts.provider);
    setModel(opts.model);
    send(message, opts);
  }}
  disabled={busy}
  sessionId={sessionId}
  contextPins={contextPins}
  onAddContextPin={(pin) => setContextPins((prev) => [...prev, pin])}
  onRemoveContextPin={(id) => setContextPins((prev) => prev.filter((p) => p.id !== id))}
/>
```

4. Update the `send` function signature to accept opts and pass provider/model to the API:

```ts
async function send(message: string, opts: { mode: 'chat' | 'agent'; provider: string; model: string; contextPins: ContextPin[] }) {
  // Build final message with context pins injected
  let fullMessage = message;
  if (opts.contextPins.length > 0) {
    const context = opts.contextPins
      .map((p) => `[Context - ${p.label}]\n${p.content}`)
      .join('\n\n');
    fullMessage = `${context}\n\n${message}`;
  }

  // ... existing send logic, but pass provider/model:
  body: JSON.stringify({ message: fullMessage, sessionId, mode: opts.mode, provider: opts.provider, model: opts.model }),
```

---

## Step 7 - Update Chat API Route to Accept model/provider Override

In `src/app/api/chat/route.ts`, the body already accepts `provider`. Also accept `model`:

```ts
const body = await req.json() as {
  message?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  mode?: 'chat' | 'agent';
};
```

Pass `model` override to `streamCarinaChat`. Update `src/lib/carina-chat.ts` `streamCarinaChat` input type to include `model?: string`. In `resolveProvider`, if a model override is provided, use it instead of the default.

---

## Verification

After this prompt:
1. The input bar has: expand chevron (bottom-left), web search toggle, Agent/Chat mode toggle, model selector, send button
2. Clicking expand chevron shows the AttachPanel with Attach files / Note as context / Inject prompt
3. Clicking Agent/Chat toggles the button label and styling
4. The model selector popover lists available models from connected BYOK keys
5. Selecting a model updates the button display
6. Context chips appear above the input when notes are pinned
7. Removing a context chip removes it from the chips display and from context injection
8. Enter sends the message, Shift+Enter adds a newline
9. Textarea auto-grows up to 160px then scrolls
10. While sending, all input elements are disabled
11. Web search enabled state is visually indicated (green icon)
12. Send button is the green circle with arrow icon
13. TypeScript builds without errors
