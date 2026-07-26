'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  ArrowUp,
  CheckSquare,
  Command,
  FileText,
  Lightbulb,
  Mic,
  MicOff,
  Search,
  X,
} from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import type { AivaEmployeeMessage, AivaWorker } from '@/lib/aiva-types';
import { timeAgo } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

function roleTitle(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return 'AI Employee';
  const first = trimmed.split(/[.!?\n]/)[0]?.trim() || trimmed;
  return first.length > 72 ? `${first.slice(0, 72)}...` : first;
}

const STARTER_PROMPTS = [
  {
    icon: FileText,
    label: 'Summarise',
    prompt: 'Summarise the latest information and give me the key takeaways.',
  },
  {
    icon: CheckSquare,
    label: 'Plan',
    prompt: 'Help me turn my goal into a clear, practical action plan.',
  },
  {
    icon: Search,
    label: 'Research',
    prompt: 'Research this topic and give me a concise, evidence-based answer: ',
  },
  {
    icon: Lightbulb,
    label: 'Brainstorm',
    prompt: 'Brainstorm useful ideas for this and organise the strongest options: ',
  },
] as const;

function useAutoResizeTextarea(minHeight = 44, maxHeight = 160) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback(
    (reset = false) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = `${minHeight}px`;
      if (!reset) {
        textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
      }
    },
    [maxHeight, minHeight],
  );

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export type AivaWorkerChatPanelProps = {
  worker: Pick<AivaWorker, 'id' | 'name' | 'roleDescription'>;
  messages: AivaEmployeeMessage[];
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  busy?: boolean;
  conversationAddon?: ReactNode;
  composerDisabled?: boolean;
  composerDisabledMessage?: string;
  headerAction?: ReactNode;
  className?: string;
};

export function AivaWorkerChatPanel({
  worker,
  messages,
  message,
  onMessageChange,
  onSend,
  busy = false,
  conversationAddon,
  composerDisabled = false,
  composerDisabledMessage = 'Finish or cancel the secure setup above.',
  headerAction,
  className,
}: AivaWorkerChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const draftBeforeVoiceRef = useRef('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const commandRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { textareaRef, adjustHeight } = useAutoResizeTextarea();
  const voice = useVoiceInput();
  const { cancelRecording } = voice;
  const title = roleTitle(worker.roleDescription ?? '');
  const composerBusy = busy || voice.isProcessing;
  const displayValue =
    voice.isRecording && voice.livePreview
      ? [draftBeforeVoiceRef.current, voice.livePreview].filter(Boolean).join(' ').trim()
      : message;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy, conversationAddon]);

  useEffect(() => () => cancelRecording(), [cancelRecording]);

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight, displayValue]);

  useEffect(() => {
    function closeCommand(event: MouseEvent) {
      if (commandRef.current && !commandRef.current.contains(event.target as Node)) {
        setCommandOpen(false);
      }
    }
    document.addEventListener('mousedown', closeCommand);
    return () => document.removeEventListener('mousedown', closeCommand);
  }, []);

  function selectPrompt(prompt: string) {
    onMessageChange(prompt);
    setCommandOpen(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      adjustHeight();
    });
  }

  async function toggleVoice() {
    if (composerBusy || composerDisabled) return;
    if (voice.isRecording) {
      const transcript = await voice.stopRecording();
      const base = draftBeforeVoiceRef.current.trim();
      const next = [base, transcript.trim()].filter(Boolean).join(' ').trim();
      onMessageChange(next);
      draftBeforeVoiceRef.current = '';
      return;
    }
    draftBeforeVoiceRef.current = message;
    await voice.startRecording();
  }

  return (
    <div
      className={cn(
        'relative isolate flex min-h-[min(72vh,680px)] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/10 sm:min-h-[min(72vh,680px)]',
        'max-lg:min-h-[calc(100dvh-11rem)] max-lg:rounded-none max-lg:border-x-0',
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_50%_-20%,color-mix(in_srgb,var(--color-accent)_16%,transparent),transparent_68%)]"
      />
      <header className="flex shrink-0 items-center gap-3 border-b border-border/70 bg-surface/80 px-4 py-3 backdrop-blur-xl">
        <AivaAvatar name={worker.name} square className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-text-primary">{worker.name}</h2>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.65)]" />
            <p className="truncate text-xs text-text-secondary">{title}</p>
          </div>
        </div>
        {headerAction}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-5">
        {messages.length === 0 ? (
          <motion.div
            className="flex h-full min-h-64 flex-col items-center justify-center px-3 text-center"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl" />
              <AivaAvatar name={worker.name} square className="relative h-14 w-14 text-lg" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-text-primary">
              How can I help today?
            </h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-text-secondary">
              Chat with {worker.name.split(' ')[0]} like a colleague. Ask a question, delegate work,
              or connect a communication channel.
            </p>
            <div className="mt-6 grid w-full max-w-xl grid-cols-2 gap-2">
              {STARTER_PROMPTS.map(({ icon: Icon, label, prompt }, index) => (
                <motion.button
                  key={label}
                  type="button"
                  onClick={() => selectPrompt(prompt)}
                  className="group flex items-center gap-2 rounded-xl border border-border/80 bg-elevated/60 px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:border-accent/30 hover:bg-elevated hover:text-text-primary"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Icon className="h-4 w-4 shrink-0 text-accent" />
                  <span>{label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((item) => {
              const mine = item.sender === 'user';
              return (
                <motion.div
                  key={item.id}
                  className={cn(
                    'flex max-w-[min(88%,34rem)] flex-col gap-1',
                    mine ? 'ml-auto items-end' : 'mr-auto items-start',
                  )}
                  initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={cn(
                      'w-fit max-w-full px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                      mine
                        ? 'rounded-2xl rounded-br-md bg-accent text-primary-foreground'
                        : 'rounded-2xl rounded-bl-md border border-border/80 bg-elevated/90 text-text-primary',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{item.content}</p>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {mine ? 'You' : worker.name}
                    {' | '}
                    {timeAgo(item.createdAt)}
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {conversationAddon}

        {busy ? (
          <motion.div
            className="mr-auto flex items-center gap-2 text-sm text-text-muted"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AivaAvatar name={worker.name} square className="h-6 w-6 text-xs" />
            <span className="sr-only">{worker.name} is thinking</span>
            <span className="inline-flex gap-1" aria-label={`${worker.name} is typing`}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
            </span>
          </motion.div>
        ) : null}
      </div>

      <footer className="shrink-0 bg-gradient-to-t from-base via-base to-transparent px-3 pb-3 pt-2 sm:px-4">
        <motion.div
          className={cn(
            'relative flex items-end gap-1 rounded-2xl border border-border bg-surface/95 p-2 shadow-xl shadow-black/10 backdrop-blur-xl transition-colors',
            composerFocused && 'border-accent/40 ring-4 ring-accent/5',
            voice.isRecording && 'border-accent/40',
          )}
          animate={composerFocused && !reduceMotion ? { scale: 1.002 } : { scale: 1 }}
        >
          <div ref={commandRef} className="relative">
            <button
              type="button"
              onClick={() => setCommandOpen((open) => !open)}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-elevated hover:text-text-primary',
                commandOpen && 'bg-elevated text-accent',
              )}
              aria-label="Open prompt suggestions"
              aria-expanded={commandOpen}
            >
              {commandOpen ? <X className="h-4 w-4" /> : <Command className="h-4 w-4" />}
            </button>
            <AnimatePresence>
              {commandOpen ? (
                <motion.div
                  className="absolute bottom-full left-0 z-30 mb-3 w-72 overflow-hidden rounded-xl border border-border bg-elevated/95 p-1.5 shadow-2xl backdrop-blur-xl"
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                >
                  <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                    Start with a prompt
                  </p>
                  {STARTER_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => selectPrompt(prompt)}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-overlay hover:text-text-primary"
                    >
                      <Icon className="h-4 w-4 text-accent" />
                      <span>{label}</span>
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <textarea
            ref={textareaRef}
            value={displayValue}
            onChange={(e) => {
              if (voice.isRecording) return;
              onMessageChange(e.target.value);
              adjustHeight();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!composerBusy && !composerDisabled && !voice.isRecording && message.trim()) onSend();
              }
            }}
            rows={1}
            onFocus={() => setComposerFocused(true)}
            onBlur={() => setComposerFocused(false)}
            readOnly={voice.isRecording || voice.isProcessing}
            disabled={composerDisabled}
            className="max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-3 text-sm leading-5 text-text-primary placeholder:text-text-muted focus:outline-none"
            placeholder={
              voice.isRecording
                ? 'Listening...'
                : voice.isProcessing
                  ? 'Transcribing...'
                  : composerDisabled
                    ? composerDisabledMessage
                    : `Type your message to ${worker.name.split(' ')[0]}...`
            }
          />
          <button
            type="button"
            onClick={() => void toggleVoice()}
            disabled={
              composerBusy
              || composerDisabled
              || voice.transcriptionHealthLoading
              || Boolean(voice.voiceBlockedReason && !voice.isRecording)
            }
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
              voice.isRecording
                ? 'bg-accent/15 text-accent ring-1 ring-accent/40'
                : 'text-text-muted hover:bg-elevated hover:text-accent',
            )}
            title={
              voice.isRecording
                ? 'Stop voice input'
                : voice.voiceBlockedReason || 'Voice input'
            }
            aria-label={voice.isRecording ? 'Stop voice input' : 'Start voice input'}
            aria-pressed={voice.isRecording}
          >
            {voice.isRecording ? (
              <MicOff className="h-4 w-4" aria-hidden />
            ) : (
              <Mic className="h-4 w-4" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={composerBusy || composerDisabled || voice.isRecording || !message.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-foreground shadow-lg shadow-accent/15 transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-elevated disabled:text-text-muted disabled:shadow-none"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        </motion.div>
        <p className="mt-2 text-center text-[10px] text-text-muted">
          Enter to send, Shift + Enter for a new line
        </p>
        {voice.error ? (
          <p className="mt-1.5 text-[11px] text-danger">{voice.error}</p>
        ) : voice.voiceBlockedReason && !voice.transcriptionHealthLoading ? (
          <p className="mt-1.5 text-[11px] text-text-muted">{voice.voiceBlockedReason}</p>
        ) : null}
      </footer>
    </div>
  );
}

export default AivaWorkerChatPanel;
