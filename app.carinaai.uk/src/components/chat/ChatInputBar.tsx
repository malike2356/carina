'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Search, Send, Terminal } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { AttachPanel } from './AttachPanel';
import { ContextChips } from './ContextChips';
import { ModelSelectorPopover } from './ModelSelectorPopover';
import type { ContextPin } from './types';

export interface ChatSendOptions {
  mode: 'chat' | 'agent';
  provider: string;
  model: string;
  contextPins: ContextPin[];
  webSearch: boolean;
}

interface ChatInputBarProps {
  onSend: (message: string, options: ChatSendOptions) => void;
  disabled: boolean;
  sessionId: string;
  contextPins: ContextPin[];
  onAddContextPin: (pin: ContextPin) => void;
  onRemoveContextPin: (id: string) => void;
}

export function ChatInputBar({
  onSend,
  disabled,
  sessionId: _sessionId,
  contextPins,
  onAddContextPin: _onAddContextPin,
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
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }

  useEffect(() => {
    autoGrow();
  }, [value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, { mode, provider, model, contextPins, webSearch });
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="relative">
      <ContextChips pins={contextPins} onRemove={onRemoveContextPin} />

      <div
        className={cn(
          'rounded-xl border border-border bg-elevated transition-colors focus-within:border-border-focus',
          disabled && 'opacity-60',
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={mode === 'agent' ? 'Give Carina a task to complete...' : 'Message Carina...'}
          disabled={disabled}
          data-chat-input="true"
          rows={1}
          className="block w-full resize-none bg-transparent px-4 pb-2 pt-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
          style={{ maxHeight: 160 }}
        />

        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-0.5">
            <div className="relative">
              <Tooltip text="Attach / expand" side="top">
                <IconButton
                  label="Expand options"
                  disabled={disabled}
                  onClick={() => setShowAttach(!showAttach)}
                >
                  <ChevronUp className={cn('h-4 w-4 transition-transform', showAttach && 'rotate-180')} />
                </IconButton>
              </Tooltip>
              {showAttach && (
                <AttachPanel
                  onClose={() => setShowAttach(false)}
                  onAttachFiles={() => {}}
                  onAttachNote={() => {
                    document.dispatchEvent(new CustomEvent('open-panel', { detail: 'notes' }));
                    setShowAttach(false);
                  }}
                  onInjectPrompt={() => setShowAttach(false)}
                />
              )}
            </div>

            <Tooltip text={webSearch ? 'Web search on' : 'Web search off'} side="top">
              <IconButton
                label={webSearch ? 'Disable web search' : 'Enable web search'}
                disabled={disabled}
                onClick={() => setWebSearch(!webSearch)}
                className={webSearch ? 'text-accent' : ''}
              >
                <Search className="h-4 w-4" />
              </IconButton>
            </Tooltip>

            {mode === 'agent' && (
              <Tooltip text="Shell tools" side="top">
                <IconButton label="Shell tools" disabled={disabled}>
                  <Terminal className="h-4 w-4" />
                </IconButton>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <ModelSelectorPopover
              selectedProvider={provider}
              selectedModel={model}
              disabled={disabled}
              onSelect={(nextProvider, nextModel) => {
                setProvider(nextProvider);
                setModel(nextModel);
              }}
            />

            <Tooltip text={mode === 'agent' ? 'Switch to Chat mode' : 'Switch to Agent mode'} side="top">
              <button
                type="button"
                onClick={() => setMode(mode === 'chat' ? 'agent' : 'chat')}
                disabled={disabled}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  mode === 'agent'
                    ? 'border-accent/30 bg-accent-dim text-accent'
                    : 'border-border bg-elevated text-text-secondary hover:text-text-primary',
                )}
              >
                {mode === 'agent' ? 'Agent' : 'Chat'}
              </button>
            </Tooltip>

            <Tooltip text="Send (Enter)" side="top">
              <button
                type="button"
                onClick={submit}
                disabled={disabled || !value.trim()}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      <p className="mt-1 text-center text-[10px] text-text-muted">
        Enter to send - Shift+Enter for new line
      </p>
    </div>
  );
}
