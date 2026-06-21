'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronUp, Mic, MicOff, Search, Send, Square, Terminal } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import { AttachPanel } from './AttachPanel';
import { ContextChips } from './ContextChips';
import { ModelSelectorPopover } from './ModelSelectorPopover';
import { ModeSwitcher } from './ModeSwitcher';
import { VoiceChat } from '@/components/ui/ia-siri-chat';
import type { ContextPin } from './types';
import { clearChatDraft, readChatDraft, writeChatDraft } from '@/lib/chat-draft';
import { getInputHistory } from '@/lib/chat-history';
import { useVoiceInput } from '@/hooks/useVoiceInput';

export interface ChatSendOptions {
  mode: 'chat' | 'agent';
  provider: string;
  model: string;
  contextPins: ContextPin[];
  webSearch: boolean;
}

const SLASH_COMMANDS = [
  { cmd: '/new', label: 'New session', desc: 'Start a fresh conversation' },
  { cmd: '/retry', label: 'Retry', desc: 'Regenerate the last response' },
  { cmd: '/undo', label: 'Undo', desc: 'Remove the last exchange' },
] as const;

interface ChatInputBarProps {
  onSend: (message: string, options: ChatSendOptions) => void;
  busy?: boolean;
  disabled: boolean;
  sessionId: string;
  contextPins: ContextPin[];
  onAddContextPin: (pin: ContextPin) => void;
  onRemoveContextPin: (id: string) => void;
  placeholder?: string;
  webSearchAvailable?: boolean;
  agentModeAvailable?: boolean;
  onStop?: () => void;
  onRetry?: () => void;
  onUndo?: () => void;
  onNewSession?: () => void;
}

export function ChatInputBar({
  onSend,
  busy = false,
  disabled,
  sessionId,
  contextPins,
  onAddContextPin: _onAddContextPin,
  onRemoveContextPin,
  placeholder,
  webSearchAvailable = false,
  agentModeAvailable = false,
  onStop,
  onRetry,
  onUndo,
  onNewSession,
}: ChatInputBarProps) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [draftLoadedSession, setDraftLoadedSession] = useState('');
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [slashIdx, setSlashIdx] = useState(-1);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceInput();

  const trimmed = value.trim();
  const showSlashPopup = trimmed.startsWith('/') && trimmed.length <= 30 && !disabled && !busy;
  const filteredCommands = showSlashPopup
    ? SLASH_COMMANDS.filter((c) => c.cmd.startsWith(trimmed))
    : [];

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
    setDraftLoadedSession('');
    setValue(readChatDraft(sessionId));
    setDraftLoadedSession(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (draftLoadedSession !== sessionId) return;
    writeChatDraft(sessionId, value);
  }, [draftLoadedSession, sessionId, value]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!agentModeAvailable && mode === 'agent') {
      setMode('chat');
    }
  }, [agentModeAvailable, mode]);

  useEffect(() => {
    if (!webSearchAvailable && webSearch) {
      setWebSearch(false);
    }
  }, [webSearchAvailable, webSearch]);

  useEffect(() => {
    setSlashIdx(-1);
  }, [value]);

  async function toggleVoiceInput() {
    if (voice.isProcessing) return;
    if (voice.isRecording) {
      const text = await voice.stopRecording();
      if (text) {
        setValue((current) => (current.trim() ? `${current.trim()} ${text}` : text));
      }
      return;
    }
    await voice.startRecording();
  }

  function executeSlashCommand(cmd: string) {
    setValue('');
    clearChatDraft(sessionId);
    if (cmd === '/new') { onNewSession?.(); }
    else if (cmd === '/retry') { onRetry?.(); }
    else if (cmd === '/undo') { onUndo?.(); }
  }

  function submit() {
    const t = value.trim();
    if (!t) return;

    const exactCmd = SLASH_COMMANDS.find((c) => c.cmd === t);
    if (exactCmd) {
      executeSlashCommand(exactCmd.cmd);
      return;
    }

    if (disabled || busy) return;
    onSend(t, { mode, provider, model, contextPins, webSearch });
    setValue('');
    clearChatDraft(sessionId);
    setHistoryIdx(-1);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlashPopup && filteredCommands.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashIdx((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashIdx((i) => (i <= 0 ? filteredCommands.length - 1 : i - 1));
        return;
      }
      if (event.key === 'Enter' && slashIdx >= 0) {
        event.preventDefault();
        executeSlashCommand(filteredCommands[slashIdx].cmd);
        return;
      }
    }

    if (event.key === 'ArrowUp' && !value.trim() && !showSlashPopup) {
      const hist = getInputHistory();
      if (hist.length === 0) return;
      event.preventDefault();
      const nextIdx = historyIdx <= 0 ? hist.length - 1 : historyIdx - 1;
      setHistoryIdx(nextIdx);
      setValue(hist[nextIdx] ?? '');
      return;
    }
    if (event.key === 'ArrowDown' && historyIdx >= 0 && !showSlashPopup) {
      const hist = getInputHistory();
      event.preventDefault();
      if (historyIdx >= hist.length - 1) {
        setHistoryIdx(-1);
        setValue('');
      } else {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setValue(hist[nextIdx] ?? '');
      }
      return;
    }
    if (event.key === 'Escape' && busy) {
      onStop?.();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="relative">
      <ContextChips pins={contextPins} onRemove={onRemoveContextPin} />

      {showSlashPopup && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-xl border border-border bg-elevated shadow-lg">
          {filteredCommands.map((item, i) => (
            <button
              key={item.cmd}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); executeSlashCommand(item.cmd); }}
              onMouseEnter={() => setSlashIdx(i)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                slashIdx === i ? 'bg-accent/10 text-text-primary' : 'text-text-primary hover:bg-border/50',
              )}
            >
              <span className="w-16 shrink-0 font-mono text-xs font-semibold text-accent">{item.cmd}</span>
              <span className="font-medium">{item.label}</span>
              <span className="ml-auto text-xs text-text-muted">{item.desc}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          'rounded-xl border border-border bg-elevated transition-colors focus-within:border-border-focus',
          disabled && !busy && 'opacity-60',
          (voice.isRecording || voice.isProcessing) && 'border-accent/40',
        )}
      >
        {(voice.isRecording || voice.isProcessing) && (
          <VoiceChat
            compact
            phase={voice.isProcessing ? 'processing' : 'listening'}
            waveformLevels={voice.levels}
            elapsedLabel={voice.elapsedLabel}
            livePreview={voice.livePreview}
            onDone={() => void toggleVoiceInput()}
            onCancel={() => voice.cancelRecording()}
          />
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => { setValue(event.target.value); setHistoryIdx(-1); }}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? (busy ? 'Responding... Press Escape to stop' : mode === 'agent' ? 'Give Carina a task...' : 'Message Carina... (/ for commands)')}
          disabled={(disabled && !busy) || voice.isRecording || voice.isProcessing}
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
                  onAttachDocument={() => {
                    router.push('/documents');
                    setShowAttach(false);
                  }}
                  onInjectPrompt={() => setShowAttach(false)}
                />
              )}
            </div>

            {webSearchAvailable && (
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
            )}

            <Tooltip
              text={
                voice.isProcessing
                  ? 'Transcribing audio...'
                  : voice.isRecording
                    ? 'Stop and transcribe'
                    : voice.voiceReady
                      ? 'Voice input'
                      : voice.voiceBlockedReason || 'Checking microphone support...'
              }
              side="top"
            >
              <IconButton
                label={voice.isRecording ? 'Stop voice input' : 'Voice input'}
                disabled={disabled || voice.isProcessing || Boolean(voice.voiceBlockedReason)}
                onClick={() => void toggleVoiceInput()}
                className={cn(
                  voice.voiceReady && !disabled && !voice.isRecording && 'text-accent hover:text-accent',
                  voice.isRecording && 'text-accent ring-1 ring-accent/40',
                )}
              >
                {voice.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </IconButton>
            </Tooltip>

            {agentModeAvailable && mode === 'agent' && (
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

            <ModeSwitcher
              mode={mode}
              onChange={setMode}
              disabled={disabled}
              agentEnabled={agentModeAvailable}
            />

            {busy ? (
              <Tooltip text="Stop (Escape)" side="top">
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop response"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-text-primary transition-colors hover:border-danger hover:text-danger"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              </Tooltip>
            ) : (
              <Tooltip text="Send (Enter)" side="top">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!value.trim()}
                  aria-label="Send message"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-black transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <p className="mt-1 text-center text-[10px] text-text-muted">
        {busy
          ? 'Escape to stop · Shift+Enter for new line'
          : 'Enter to send · Shift+Enter for new line · / for commands · Up arrow recalls history'}
        {voice.error ? (
          <span className="block mt-0.5 text-danger">{voice.error}</span>
        ) : null}
      </p>
    </div>
  );
}
