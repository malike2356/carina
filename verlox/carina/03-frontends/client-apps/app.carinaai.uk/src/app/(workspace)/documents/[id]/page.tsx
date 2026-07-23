'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  MessageSquare,
  PenLine,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { CoreSurfaceBanner } from '@/components/shell/CoreSurfaceBanner';
import { IconButton } from '@/components/ui/IconButton';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { CarinaEditor, type CarinaEditorHandle } from '@/components/editor';
import { cn } from '@/lib/utils';

type AssistAction = 'format' | 'spellcheck' | 'factcheck';
type AssistMode = 'insert' | 'replace';

const DEFAULT_INLINE_PROMPT = 'write the next paragraph';

export default function DocumentEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [assistBusy, setAssistBusy] = useState<string | null>(null);
  const [inlinePrompt, setInlinePrompt] = useState('');
  const [deleting, setDeleting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<CarinaEditorHandle>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/documents/${params.id}`);
    const data = await res.json();
    if (!data.data) {
      router.push('/documents');
      return;
    }
    setTitle(data.data.title);
    setContent(data.data.content);
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    async (nextTitle: string, nextContent: string) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      setSaving(true);
      setSaved(false);
      setSaveError(null);
      const res = await fetch(`/api/documents/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle, content: nextContent }),
      });
      if (!res.ok) {
        let message = 'Save failed';
        try {
          const data = (await res.json()) as { error?: string };
          message = data.error ?? message;
        } catch {
          message = 'Save failed';
        }
        setSaveError(message);
        setSaving(false);
        return;
      }
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    [params.id],
  );

  function scheduleSave(nextTitle: string, nextContent: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(nextTitle, nextContent), 1000);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave(value, content);
  }

  function handleContentChange(value: string) {
    setContent(value);
    scheduleSave(title, value);
  }

  async function saveNow() {
    await persist(title, content);
  }

  function applyAssistResult(
    result: string,
    mode: AssistMode,
    selection: string,
  ) {
    if (mode === 'insert') {
      editorRef.current?.insertText(result);
      return;
    }

    if (selection) {
      editorRef.current?.replaceSelection(result);
      return;
    }

    setContent(result);
    scheduleSave(title, result);
  }

  async function requestAssist(body: Record<string, unknown>, busyLabel: string) {
    setAssistBusy(busyLabel);
    const selection =
      editorRef.current?.getSelection().trim() ||
      (typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '') ||
      '';

    const res = await fetch(`/api/documents/${params.id}/assist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        selection: body.selection ?? (selection || undefined),
        content,
      }),
    });
    const data = (await res.json()) as {
      content?: string;
      mode?: AssistMode;
      error?: string;
    };
    setAssistBusy(null);

    if (!res.ok) {
      alert(data.error || 'Assist failed');
      return;
    }

    if (!data.content) return;
    applyAssistResult(
      data.content,
      data.mode ?? (body.mode as AssistMode) ?? 'replace',
      String(body.selection ?? selection ?? ''),
    );
  }

  async function runAssist(action: AssistAction) {
    await requestAssist({ action }, action);
  }

  async function runInlineCommand(prompt = inlinePrompt) {
    const instruction = prompt.trim();
    if (!instruction) return;
    const selection = editorRef.current?.getSelection().trim() ?? '';
    await requestAssist(
      {
        instruction,
        mode: selection ? 'replace' : 'insert',
        selection: selection || undefined,
      },
      'inline',
    );
    setInlinePrompt('');
  }

  function exportMarkdown() {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'document'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function deleteDocument() {
    const label = title.trim() || 'Untitled';
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

    setDeleting(true);
    const res = await fetch(`/api/documents/${params.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (!res.ok) {
      alert('Could not delete document');
      return;
    }
    router.push('/documents');
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden" data-page-title={title}>
      <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
        <Link href="/documents" className="text-text-muted hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none"
          placeholder="Document title"
        />
        <div className="min-w-0 text-[10px] text-text-muted">
          {saveError ? (
            <span className="text-danger">{saveError}</span>
          ) : saving ? 'Saving...' : saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3" /> Saved
            </span>
          ) : (
            'Autosave on'
          )}
        </div>
        <button
          type="button"
          onClick={() => void saveNow()}
          disabled={saving}
          className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
        <IconButton label="Export markdown" onClick={exportMarkdown}>
          <Download className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Pin to chat"
          onClick={async () => {
            const res = await fetch('/api/sessions', { method: 'POST' });
            const data = await res.json();
            if (data.data?.id) {
              router.push(`/chat/${data.data.id}?document=${params.id}`);
            }
          }}
        >
          <MessageSquare className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Delete document"
          disabled={deleting}
          onClick={() => void deleteDocument()}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-danger" />
          )}
        </IconButton>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-border lg:border-r">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={cn(
                'rounded px-2 py-1 text-xs',
                !preview ? 'bg-elevated text-text-primary' : 'text-text-muted',
              )}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={cn(
                'rounded px-2 py-1 text-xs',
                preview ? 'bg-elevated text-text-primary' : 'text-text-muted',
              )}
            >
              Preview
            </button>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
              <CoreSurfaceBanner surface="documents" />
              {preview ? (
                <MarkdownContent content={content || '_Empty document_'} />
              ) : (
                <CarinaEditor
                  ref={editorRef}
                  value={content}
                  onChange={handleContentChange}
                  showEngineSwitch
                  placeholder="Start typing. Ask Carina inline below to continue or expand your draft."
                  minHeight="50vh"
                />
              )}
            </div>
            {!preview && (
              <form
                className="min-w-0 shrink-0 border-t border-border px-3 py-3 sm:px-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runInlineCommand();
                }}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-elevated px-2 py-1.5 focus-within:border-accent/50 sm:flex-nowrap">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="shrink-0 text-xs text-text-muted">Carina,</span>
                  <input
                    value={inlinePrompt}
                    onChange={(event) => setInlinePrompt(event.target.value)}
                    onFocus={() => editorRef.current?.focus()}
                    disabled={assistBusy !== null}
                    placeholder={DEFAULT_INLINE_PROMPT}
                    className="min-w-[10rem] flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                  />
                  <button
                    type="submit"
                    disabled={assistBusy !== null || !inlinePrompt.trim()}
                    className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                  >
                    {assistBusy === 'inline' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Run'
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-text-muted">
                  Enter to run. Inserts at your cursor, or replaces selected text.
                </p>
              </form>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-border p-3 sm:p-4 lg:w-72 lg:border-t-0">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            AI assist
          </p>
          <p className="mb-4 text-[11px] text-text-muted">
            Use the inline bar to draft new text, or pick a quick action below.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              disabled={assistBusy !== null}
              onClick={() => void runInlineCommand(DEFAULT_INLINE_PROMPT)}
              className="flex w-full items-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-left text-xs text-text-primary hover:bg-accent/10 disabled:opacity-50"
            >
              {assistBusy === 'inline' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PenLine className="h-3.5 w-3.5 text-accent" />
              )}
              Write next paragraph
            </button>
            {(
              [
                ['format', 'Fix formatting', Wand2],
                ['spellcheck', 'Fix spelling', Wand2],
                ['factcheck', 'Fact-check', Wand2],
              ] as const
            ).map(([action, label, Icon]) => (
              <button
                key={action}
                type="button"
                disabled={assistBusy !== null}
                onClick={() => void runAssist(action)}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-xs text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-50"
              >
                {assistBusy === action ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-accent" />
                )}
                {label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
