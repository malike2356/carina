'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Download,
  FileUp,
  Loader2,
  Mail,
  MessageSquare,
  PenLine,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { CoreSurfaceBanner } from '@/components/shell/CoreSurfaceBanner';
import { IconButton } from '@/components/ui/IconButton';
import { CarinaEditor, type CarinaEditorHandle } from '@/components/editor';
import {
  blobToBase64,
  docxArrayBufferToHtml,
  downloadBlob,
  htmlToDocxBlob,
  safeDownloadBasename,
} from '@/components/editor/docx-bridge';
import { looksLikeHtml } from '@/components/editor/tiptap-extensions';
import {
  htmlToPlainText,
  normalizeDocumentHtml,
} from '@/components/editor/markdown-normalize';
import { cn } from '@/lib/utils';

type AssistAction = 'format' | 'spellcheck' | 'factcheck';
type AssistMode = 'insert' | 'replace';

const DEFAULT_INLINE_PROMPT = 'write the next paragraph';

function countWords(content: string, format: string): number {
  const text = format === 'html' || looksLikeHtml(content) ? htmlToPlainText(content) : content;
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function DocumentEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState<'markdown' | 'html'>('html');
  const [vaultKind, setVaultKind] = useState<string | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [conflictNote, setConflictNote] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [assistBusy, setAssistBusy] = useState<string | null>(null);
  const [inlinePrompt, setInlinePrompt] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailAttachDocx, setEmailAttachDocx] = useState(true);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<CarinaEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = useMemo(() => countWords(content, format), [content, format]);

  const persist = useCallback(
    async (nextTitle: string, nextContent: string, nextFormat: 'markdown' | 'html' = 'html') => {
      setSaving(true);
      setSaved(false);
      setConflictNote(null);
      const res = await fetch(`/api/documents/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nextTitle,
          content: nextContent,
          format: nextFormat,
          expectedRevision: revision ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setConflictNote(data.error || 'Stale revision. Reload before saving again.');
        setSaving(false);
        return;
      }
      if (data.data?.currentRevision != null) {
        setRevision(Number(data.data.currentRevision));
      }
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    [params.id, revision],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/documents/${params.id}`);
    const data = await res.json();
    if (!data.data) {
      router.push('/documents');
      return;
    }
    const raw = String(data.data.content ?? '');
    const kind = typeof data.data.kind === 'string' ? data.data.kind : null;
    setVaultKind(kind);
    setRevision(
      data.data.currentRevision != null ? Number(data.data.currentRevision) : null,
    );
    setSyncStatus(typeof data.data.syncStatus === 'string' ? data.data.syncStatus : null);
    if (data.data.conflict) setConflictNote('Sync conflict. Keep both versions or choose one.');
    const nextTitle = String(data.data.title ?? 'Untitled');
    setTitle(nextTitle);

    if (kind === 'plain_text' || kind === 'spreadsheet' || kind === 'markdown' || kind === 'presentation') {
      setContent(raw);
      setFormat(kind === 'markdown' ? 'markdown' : 'markdown');
      setLoading(false);
      return;
    }

    const nextContent = normalizeDocumentHtml(raw);
    setContent(nextContent);
    setFormat('html');
    setLoading(false);
    if (nextContent && nextContent !== raw) {
      void persist(nextTitle, nextContent, 'html');
    }
  }, [params.id, router, persist]);

  useEffect(() => {
    void load();
  }, [load]);

  function scheduleSave(nextTitle: string, nextContent: string, nextFormat: 'markdown' | 'html' = 'html') {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(nextTitle, nextContent, nextFormat), 1000);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave(value, content, format);
  }

  function handleContentChange(value: string) {
    setContent(value);
    setFormat('html');
    scheduleSave(title, value, 'html');
  }

  function applyAssistResult(
    result: string,
    mode: AssistMode,
    selection: string,
  ) {
    const normalized = normalizeDocumentHtml(result);

    if (mode === 'insert') {
      editorRef.current?.insertText(normalized);
      return;
    }

    if (selection) {
      editorRef.current?.replaceSelection(normalized);
      return;
    }

    setContent(normalized);
    setFormat('html');
    scheduleSave(title, normalized, 'html');
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
        content: format === 'html' ? htmlToPlainText(content) : content,
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

  async function exportDocx() {
    setExporting(true);
    try {
      const html = editorRef.current?.getHtml?.() || content || '<p></p>';
      const blob = await htmlToDocxBlob(html, title);
      downloadBlob(blob, safeDownloadBasename(title, 'docx'));
    } catch (err) {
      console.error(err);
      alert('Could not export Word document');
    } finally {
      setExporting(false);
    }
  }

  async function importDocx(file: File) {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const html = await docxArrayBufferToHtml(buffer);
      editorRef.current?.setHtml?.(html);
      setContent(html);
      setFormat('html');
      if (!title.trim() || title === 'Untitled') {
        const nextTitle = file.name.replace(/\.docx$/i, '') || 'Imported document';
        setTitle(nextTitle);
        scheduleSave(nextTitle, html, 'html');
      } else {
        scheduleSave(title, html, 'html');
      }
    } catch (err) {
      console.error(err);
      alert('Could not import Word document');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  function openEmailComposer() {
    const label = title.trim() || 'Untitled';
    setEmailTo('');
    setEmailSubject(label);
    setEmailBody(`Please find "${label}" attached.\n\nSent from Aiva Documents.`);
    setEmailAttachDocx(true);
    setEmailError(null);
    setEmailNotice(null);
    setEmailOpen(true);
  }

  async function sendDocumentEmail() {
    const to = emailTo.trim();
    const subject = emailSubject.trim();
    if (!to || !subject) {
      setEmailError('To and subject are required');
      return;
    }

    setEmailSending(true);
    setEmailError(null);
    setEmailNotice(null);
    try {
      const attachments: Array<{
        filename: string;
        mimeType: string;
        contentBase64: string;
      }> = [];

      if (emailAttachDocx) {
        const html = editorRef.current?.getHtml?.() || content || '<p></p>';
        const blob = await htmlToDocxBlob(html, title);
        const contentBase64 = await blobToBase64(blob);
        attachments.push({
          filename: safeDownloadBasename(title, 'docx'),
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentBase64,
        });
      }

      const res = await fetch('/api/email/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body: emailBody,
          attachments,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setEmailError(data.error || 'Send failed');
        return;
      }
      setEmailNotice(
        emailAttachDocx
          ? 'Sent with Word attachment. Check Email → Sent.'
          : 'Sent. Check Email → Sent.',
      );
      setTimeout(() => {
        setEmailOpen(false);
        setEmailNotice(null);
      }, 1600);
    } catch (err) {
      console.error(err);
      setEmailError('Could not send email');
    } finally {
      setEmailSending(false);
    }
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
      {emailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Email document"
            className="w-full max-w-lg rounded-xl border border-border bg-surface p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary">Email document</p>
              <button
                type="button"
                className="rounded p-1 text-text-muted hover:bg-elevated hover:text-text-primary"
                aria-label="Close"
                onClick={() => !emailSending && setEmailOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-2 block text-[11px] text-text-muted">
              To
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="frank@example.com"
                className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="mb-2 block text-[11px] text-text-muted">
              Subject
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="mb-2 block text-[11px] text-text-muted">
              Message
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={5}
                className="mt-1 w-full resize-y rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="mb-3 flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={emailAttachDocx}
                onChange={(e) => setEmailAttachDocx(e.target.checked)}
              />
              Attach as Word (.docx)
            </label>
            {emailError ? <p className="mb-2 text-[11px] text-danger">{emailError}</p> : null}
            {emailNotice ? <p className="mb-2 text-[11px] text-emerald-400">{emailNotice}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={emailSending}
                onClick={() => setEmailOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs text-text-muted hover:bg-elevated"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={emailSending || !emailTo.trim() || !emailSubject.trim()}
                onClick={() => void sendDocumentEmail()}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                {emailSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
        <Link href="/documents" className="shrink-0 text-text-muted hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="min-w-0 flex-1 basis-[10rem] bg-transparent text-sm font-semibold text-text-primary outline-none"
          placeholder="Document title"
        />
        <div className="flex shrink-0 items-center gap-2 text-[10px] text-text-muted">
          <span>{wordCount} words</span>
          {revision != null ? (
            <>
              <span aria-hidden>|</span>
              <span>rev {revision}</span>
            </>
          ) : null}
          {syncStatus ? (
            <>
              <span aria-hidden>|</span>
              <span>{syncStatus}</span>
            </>
          ) : null}
          <span aria-hidden>|</span>
          {saving ? 'Saving...' : saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3" /> Saved
            </span>
          ) : (
            'Autosave on'
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importDocx(file);
            }}
          />
          <IconButton
            label="Import Word (.docx)"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          </IconButton>
          <IconButton label="Export Word (.docx)" disabled={exporting} onClick={() => void exportDocx()}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </IconButton>
          <IconButton label="Email document" onClick={openEmailComposer}>
            <Mail className="h-4 w-4" />
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
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-border lg:border-r">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="px-3 pt-2 sm:px-4">
                <CoreSurfaceBanner surface="documents" />
                {conflictNote ? (
                  <div className="mb-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                    {conflictNote}
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={() => void load()}
                    >
                      Reload
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="min-h-0 flex-1">
                {vaultKind === 'plain_text' || vaultKind === 'markdown' || vaultKind === 'presentation' ? (
                  <textarea
                    value={content}
                    onChange={(event) => {
                      const next = event.target.value;
                      setContent(next);
                      setFormat(vaultKind === 'markdown' ? 'markdown' : 'markdown');
                      scheduleSave(title, next, vaultKind === 'markdown' ? 'markdown' : 'markdown');
                    }}
                    className="h-full min-h-[70vh] w-full resize-none bg-transparent px-4 py-3 font-mono text-sm text-text-primary outline-none"
                    placeholder={
                      vaultKind === 'markdown'
                        ? 'Write Markdown…'
                        : vaultKind === 'presentation'
                          ? 'Outline slides as plain text (one slide per section)…'
                          : 'Write plain text…'
                    }
                  />
                ) : vaultKind === 'spreadsheet' ? (
                  <textarea
                    value={content}
                    onChange={(event) => {
                      const next = event.target.value;
                      setContent(next);
                      scheduleSave(title, next, 'markdown');
                    }}
                    className="h-full min-h-[70vh] w-full resize-none bg-transparent px-4 py-3 font-mono text-sm text-text-primary outline-none"
                    placeholder={'col1,col2\nvalue,value'}
                    aria-label="Spreadsheet CSV editor"
                  />
                ) : vaultKind === 'pdf' || vaultKind === 'binary_upload' ? (
                  <div className="px-4 py-8 text-sm text-text-muted">
                    This file type is preview-only in the vault for now. Download from the explorer when binary
                    downloads ship with sync.
                  </div>
                ) : (
                  <CarinaEditor
                    ref={editorRef}
                    value={content}
                    onChange={handleContentChange}
                    engine="tiptap"
                    defaultEngine="tiptap"
                    showEngineSwitch={false}
                    contentFormat="html"
                    toolbarDensity="full"
                    pageLayout
                    className="h-full"
                    placeholder="Start writing your document. Import a Word file, or ask Aiva to draft the next section."
                    minHeight="70vh"
                  />
                )}
              </div>
            </div>
            <form
              className="shrink-0 border-t border-border px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                void runInlineCommand();
              }}
            >
              <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated px-2 py-1.5 focus-within:border-accent/50">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="shrink-0 text-xs text-text-muted">Aiva,</span>
                <input
                  value={inlinePrompt}
                  onChange={(event) => setInlinePrompt(event.target.value)}
                  onFocus={() => editorRef.current?.focus()}
                  disabled={assistBusy !== null}
                  placeholder={DEFAULT_INLINE_PROMPT}
                  className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
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
                Enter to run. Inserts at your cursor, or replaces selected text. Use Import/Export for Word files.
              </p>
            </form>
          </div>
        </div>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-border p-4 lg:w-72 lg:border-t-0">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            AI assist
          </p>
          <p className="mb-4 text-[11px] text-text-muted">
            Draft, clean up, or fact-check. Formatting stays in the page editor.
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
          <div className="mt-6 rounded-md border border-border p-3">
            <p className="text-[11px] font-semibold text-text-primary">Word workspace</p>
            <p className={cn('mt-1 text-[11px] text-text-muted')}>
              Full toolbar, page canvas, tables, images, fonts, and DOCX import/export.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
