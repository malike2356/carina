'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Mic, MicOff, Paperclip, Send } from 'lucide-react';
import { AivaAvatar } from '@/components/aiva/AivaAvatar';
import { AivaChatMarkdown } from '@/components/aiva/AivaChatMarkdown';
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

export type AivaWorkerChatPanelProps = {
  worker: Pick<AivaWorker, 'id' | 'name' | 'roleDescription'>;
  messages: AivaEmployeeMessage[];
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  busy?: boolean;
  conversationAddon?: ReactNode;
  headerAction?: ReactNode;
  headerBanner?: ReactNode;
  composerDisabled?: boolean;
  composerDisabledMessage?: string;
  className?: string;
  /** Pending analysis attachment shown above the composer. */
  pendingAttachmentName?: string | null;
  onClearPendingAttachment?: () => void;
  onPickAttachment?: (file: File) => void | Promise<void>;
  canSendWithoutText?: boolean;
  /**
   * Studio-style workspace: flat surface, slim chrome, wide transcript.
   * Use on the worker Chat tab.
   */
  variant?: 'default' | 'workspace';
};

export function AivaWorkerChatPanel({
  worker,
  messages,
  message,
  onMessageChange,
  onSend,
  busy = false,
  conversationAddon,
  headerAction,
  headerBanner,
  composerDisabled = false,
  composerDisabledMessage = 'Finish or cancel the secure setup above.',
  className,
  pendingAttachmentName = null,
  onClearPendingAttachment,
  onPickAttachment,
  canSendWithoutText = false,
  variant = 'default',
}: AivaWorkerChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftBeforeVoiceRef = useRef('');
  const voice = useVoiceInput();
  const { cancelRecording } = voice;
  const title = roleTitle(worker.roleDescription ?? '');
  const workspace = variant === 'workspace';
  const composerBusy = busy || voice.isProcessing;
  const canSend =
    !composerBusy
    && !composerDisabled
    && !voice.isRecording
    && (Boolean(message.trim()) || (canSendWithoutText && Boolean(pendingAttachmentName)));
  const displayValue =
    voice.isRecording && voice.livePreview
      ? [draftBeforeVoiceRef.current, voice.livePreview].filter(Boolean).join(' ').trim()
      : message;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, conversationAddon]);

  useEffect(() => () => cancelRecording(), [cancelRecording]);

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
        'flex h-full min-h-0 max-w-full flex-col overflow-hidden bg-base',
        !workspace && 'rounded-xl border border-border bg-surface max-lg:rounded-none max-lg:border-x-0',
        className,
      )}
    >
      <header
        className={cn(
          'flex shrink-0 items-center gap-3 border-b border-border/80',
          workspace ? 'px-3 py-2 sm:px-4' : 'px-4 py-3',
        )}
      >
        {!workspace ? (
          <>
            <AivaAvatar name={worker.name} square className="h-10 w-10" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-text-primary">{worker.name}</h2>
              <p className="truncate text-sm text-text-secondary">{title}</p>
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{worker.name}</p>
            <p className="truncate text-[11px] text-text-muted">{title}</p>
          </div>
        )}
        {headerAction ? <div className="flex shrink-0 items-center gap-1.5">{headerAction}</div> : null}
      </header>
      {headerBanner ? (
        <div className="shrink-0 border-b border-border/70 bg-elevated/30 px-3 py-1.5">
          {headerBanner}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className={cn(
        'min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain',
          workspace ? 'px-4 py-5 sm:px-8 lg:px-10 xl:px-14' : 'px-4 py-4 sm:px-6 lg:px-8',
        )}
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
            <AivaAvatar name={worker.name} square className="mb-3 h-12 w-12 text-lg" />
            <p className="text-sm font-medium text-text-primary">Welcome to your team</p>
            <p className="mt-1 max-w-md text-sm text-text-secondary">
              {worker.name} is ready to help. Start a conversation below.
            </p>
          </div>
        ) : (
          messages.map((item) => {
            const mine = item.sender === 'user';
            return (
              <div
                key={item.id}
                className={cn(
                  'flex w-full flex-col gap-1',
                  workspace
                    ? 'max-w-[min(96%,64rem)] xl:max-w-[min(94%,72rem)]'
                    : 'max-w-[min(94%,48rem)] xl:max-w-[min(92%,56rem)]',
                  mine ? 'ml-auto items-end' : 'mr-auto items-start',
                )}
              >
                <div
                  className={cn(
                    'w-fit max-w-full px-3.5 py-2.5 text-sm leading-relaxed',
                    mine
                      ? 'rounded-2xl rounded-br-md bg-bubble-user text-text-primary'
                      : workspace
                        ? 'rounded-2xl rounded-bl-md bg-elevated/80 text-text-primary'
                        : 'rounded-lg rounded-bl-sm border border-border bg-elevated text-text-primary shadow-sm shadow-black/5',
                  )}
                >
                  {mine ? (
                    <p className="whitespace-pre-wrap">{item.content}</p>
                  ) : (
                    <AivaChatMarkdown content={item.content} />
                  )}
                </div>
                <p className="text-[11px] text-text-muted">
                  {mine ? 'You' : worker.name}
                  {' · '}
                  {timeAgo(item.createdAt)}
                </p>
              </div>
            );
          })
        )}

        {conversationAddon}

        {busy ? (
          <div className="mr-auto flex items-center gap-2 text-sm text-text-muted">
            <AivaAvatar name={worker.name} square className="h-6 w-6 text-xs" />
            <span className="inline-flex gap-1" aria-label={`${worker.name} is typing`}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:240ms]" />
            </span>
          </div>
        ) : null}
      </div>

      <footer
        className={cn(
          'sticky bottom-0 z-10 shrink-0 border-t border-border/80 bg-base',
          workspace ? 'px-4 py-3 sm:px-8 lg:px-10 xl:px-14' : 'px-3 py-3',
        )}
      >
        {pendingAttachmentName ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-elevated/40 px-3 py-2 text-xs text-text-secondary">
            <span className="min-w-0 flex-1 truncate">
              Attached: <span className="font-medium text-text-primary">{pendingAttachmentName}</span>
            </span>
            {onClearPendingAttachment ? (
              <button
                type="button"
                className="shrink-0 text-text-muted hover:text-text-primary"
                onClick={onClearPendingAttachment}
              >
                Remove
              </button>
            ) : null}
          </div>
        ) : null}
        <div
          className={cn(
            'flex items-end gap-2 rounded-2xl border border-border bg-surface px-3 py-2',
            workspace && 'max-w-[min(96%,64rem)] xl:max-w-[min(94%,72rem)]',
            voice.isRecording && 'border-accent/40',
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".sav,.csv,.tsv,.xlsx,.xls,.txt,.pdf,.png,.jpg,.jpeg,.webp,.docx,application/x-spss-sav,text/csv,application/pdf,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file && onPickAttachment) void onPickAttachment(file);
            }}
          />
          <button
            type="button"
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-elevated hover:text-text-primary disabled:opacity-40"
            title="Attach SPSS/CSV for analysis"
            aria-label="Attach SPSS or CSV file"
            disabled={composerBusy || composerDisabled || !onPickAttachment}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" aria-hidden />
          </button>
          <textarea
            value={displayValue}
            onChange={(e) => {
              if (voice.isRecording) return;
              onMessageChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            rows={1}
            readOnly={voice.isRecording || voice.isProcessing}
            disabled={composerDisabled}
            className="max-h-32 min-h-[2.25rem] min-w-0 flex-1 resize-none bg-transparent py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            placeholder={
              voice.isRecording
                ? 'Listening...'
                : voice.isProcessing
                  ? 'Transcribing...'
                  : composerDisabled
                    ? composerDisabledMessage
                  : pendingAttachmentName
                    ? `Ask ${worker.name.split(' ')[0]} to analyse the file...`
                  : `Message ${worker.name.split(' ')[0]}...`
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
              'mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
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
            disabled={!canSend}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-text-primary text-surface transition-opacity disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
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
