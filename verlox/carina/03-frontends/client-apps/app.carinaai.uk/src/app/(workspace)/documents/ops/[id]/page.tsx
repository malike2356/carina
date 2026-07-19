'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  Save,
  Trash2,
} from 'lucide-react';
import { CarinaEditor, type CarinaEditorHandle } from '@/components/editor';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

type OpsDocResponse = {
  document?: {
    id: string;
    title: string;
    content: string;
    charCount?: number;
  };
  mapping?: {
    category?: string;
    syncStatus?: string;
    driveWebViewLink?: string;
  } | null;
  error?: string;
};

function OpsDocumentEditorInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const workerId = searchParams.get('workerId')?.trim() || '';
  const documentId = params.id;

  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState('');
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<CarinaEditorHandle>(null);

  const backHref = workerId
    ? `/aiva/workers/${encodeURIComponent(workerId)}?tab=drive-docs&section=files`
    : '/documents?tab=drive';

  const load = useCallback(async () => {
    if (!workerId || !documentId) {
      setError('Missing worker or document id.');
      setMissing(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setMissing(false);
    const qs = new URLSearchParams({ workerId });
    const res = await fetch(
      `/api/aiva/workspace-ops/documents/${encodeURIComponent(documentId)}?${qs}`,
    );
    const data = (await res.json()) as OpsDocResponse;
    if (!res.ok || !data.document) {
      setError(data.error ?? 'Document not found in Aiva knowledge base.');
      setMissing(true);
      setLoading(false);
      return;
    }
    setTitle(data.document.title || 'Untitled');
    setContent(data.document.content || '');
    setDriveLink(data.mapping?.driveWebViewLink || null);
    setSyncStatus(data.mapping?.syncStatus ?? null);
    setCategory(data.mapping?.category ?? null);
    setLoading(false);
  }, [documentId, workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (nextTitle: string, nextContent: string) => {
      if (!workerId || !documentId) return;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      setSaving(true);
      setSaved(false);
      setSaveError(null);
      const res = await fetch(
        `/api/aiva/workspace-ops/documents/${encodeURIComponent(documentId)}?workerId=${encodeURIComponent(workerId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workerId,
            title: nextTitle,
            content: nextContent,
          }),
        },
      );
      const data = (await res.json()) as OpsDocResponse;
      setSaving(false);
      if (!res.ok) {
        const message = data.error ?? 'Save failed';
        setError(message);
        setSaveError(message);
        return;
      }
      setError(null);
      setSaveError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    [documentId, workerId],
  );

  function scheduleSave(nextTitle: string, nextContent: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(nextTitle, nextContent), 1000);
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

  async function deleteDocument() {
    const label = title.trim() || 'Untitled';
    if (!window.confirm(`Delete "${label}" from Aiva and trash the Drive copy if linked?`)) {
      return;
    }
    setDeleting(true);
    const res = await fetch(
      `/api/aiva/workspace-ops/documents/${encodeURIComponent(documentId)}?workerId=${encodeURIComponent(workerId)}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId }),
      },
    );
    setDeleting(false);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      alert(data.error ?? 'Could not delete document');
      return;
    }
    router.push(backHref);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  if (missing) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 px-6 py-16 text-center">
        <p className="text-sm font-medium text-text-primary">Could not open Aiva document</p>
        <p className="text-xs text-danger">{error}</p>
        <Link href={backHref} className="text-sm text-accent hover:underline">
          Back to Drive files
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-page-title={title}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Link href={backHref} className="text-text-muted hover:text-text-primary" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none"
          placeholder="Document title"
        />
        <div className="flex items-center gap-2 text-[10px] text-text-muted">
          {category ? <span className="uppercase">{category}</span> : null}
          {syncStatus ? <span>{syncStatus}</span> : null}
          {saveError ? (
            <span className="text-danger">{saveError}</span>
          ) : saving ? (
            'Saving...'
          ) : saved ? (
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
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </button>
        {driveLink ? (
          <a
            href={driveLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Open in Drive
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <IconButton label="Delete document" disabled={deleting} onClick={() => void deleteDocument()}>
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-danger" />
          )}
        </IconButton>
      </header>

      {error ? (
        <p className="border-b border-border px-4 py-2 text-xs text-danger">{error}</p>
      ) : null}

      <div className="flex flex-1 min-h-0 flex-col">
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
          <p className="ml-auto text-[10px] text-text-muted">
            Edits save to Aiva knowledge and push to the linked Drive file when sync is enabled.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {preview ? (
            <MarkdownContent content={content || '_Empty document_'} />
          ) : (
            <CarinaEditor
              ref={editorRef}
              value={content}
              onChange={handleContentChange}
              showEngineSwitch
              placeholder="Edit this Ops document. Changes autosave to Aiva and sync toward Drive."
              minHeight="50vh"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpsDocumentEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      }
    >
      <OpsDocumentEditorInner />
    </Suspense>
  );
}
