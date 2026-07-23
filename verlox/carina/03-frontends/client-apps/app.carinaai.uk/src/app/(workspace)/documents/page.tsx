'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, FolderSync, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { WorkspaceOpsConsole } from '@/components/aiva/WorkspaceOpsConsole';
import { CoreSurfaceBanner } from '@/components/shell/CoreSurfaceBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { OriginBadge } from '@/components/ui/OriginBadge';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import { Spinner } from '@/components/ui/Spinner';
import { DOCUMENTS_ORIGIN_HELPER_TEXT, matchesOriginFilter, type OriginFilter } from '@/lib/sync-ownership';
import { cn } from '@/lib/utils';

interface DocumentRow {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

type DocumentsTab = 'workspace' | 'drive';

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function parseTab(raw: string | null): DocumentsTab {
  return raw === 'drive' ? 'drive' : 'workspace';
}

function WorkspaceDocumentsPanel() {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<OriginFilter>('local');
  const router = useRouter();

  const filteredRows = rows.filter((row) =>
    matchesOriginFilter({ origin: 'local' }, originFilter),
  );

  async function load() {
    setLoading(true);
    const res = await fetch('/api/documents');
    const data = await res.json();
    if (data.data) setRows(data.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createDocument() {
    setCreating(true);
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled' }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.data?.id) router.push(`/documents/${data.data.id}`);
  }

  async function deleteDocument(id: string, title: string) {
    const label = title.trim() || 'Untitled';
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

    setDeletingId(id);
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    setDeletingId(null);
    if (!res.ok) {
      alert('Could not delete document');
      return;
    }
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <>
      <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <OriginFilterChips value={originFilter} onChange={setOriginFilter} />
          <p className="text-[11px] text-text-muted">
            Workspace docs are local until mirrored to Drive Ops. {DOCUMENTS_ORIGIN_HELPER_TEXT}
          </p>
        </div>
        <div className="grid w-full grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto">
        <IconButton label="Refresh" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
        </IconButton>
        <button
          type="button"
          onClick={() => void createDocument()}
          disabled={creating}
          className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {creating ? <Spinner size="sm" /> : <Plus className="h-3.5 w-3.5" />}
          New document
        </button>
        </div>
      </div>

      <CoreSurfaceBanner surface="documents" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No documents yet"
          subtitle="Create a document and type freely. Use the inline Carina bar to write the next paragraph or expand your ideas."
          action={
            <button
              type="button"
              onClick={() => void createDocument()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs text-white"
            >
              Create document
            </button>
          }
        />
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((doc) => (
            <div
              key={doc.id}
              className="group relative min-w-0 overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-accent/40 hover:bg-elevated"
            >
              <Link href={`/documents/${doc.id}`} className="block p-4 pr-10">
                <div className="mb-1 flex min-w-0 items-start gap-2">
                  <h2 className="min-w-0 flex-1 break-words text-sm font-medium text-text-primary">{doc.title}</h2>
                  <OriginBadge origin="local" />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                  {doc.content.trim() || 'Empty document'}
                </p>
                <p className="mt-3 text-[10px] text-text-muted">
                  {wordCount(doc.content)} words · Updated {formatDate(doc.updatedAt)}
                </p>
              </Link>
              <IconButton
                label="Delete document"
                className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                disabled={deletingId === doc.id}
                onClick={() => void deleteDocument(doc.id, doc.title)}
              >
                {deletingId === doc.id ? (
                  <Spinner size="sm" />
                ) : (
                  <Trash2 className="h-4 w-4 text-danger" />
                )}
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function DocumentsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = parseTab(searchParams.get('tab'));

  function setTab(next: DocumentsTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'drive') params.set('tab', 'drive');
    else params.delete('tab');
    if (next !== 'drive') {
      params.delete('section');
      params.delete('workerId');
    }
    const qs = params.toString();
    router.replace(qs ? `/documents?${qs}` : '/documents');
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <header className="border-b border-border px-3 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Documents</h1>
            <p className="text-xs text-text-muted">
              {tab === 'drive'
                ? 'Upload files to Google Drive and the document vault so Aiva can learn from them.'
                : 'Type freely; ask Carina inline to continue or polish your draft.'}
            </p>
          </div>
        </div>
        <nav className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Documents sections">
          <button
            type="button"
            onClick={() => setTab('workspace')}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition sm:px-3.5',
              tab === 'workspace'
                ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                : 'bg-muted/60 text-text-secondary hover:bg-muted hover:text-text-primary',
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            Workspace
          </button>
          <button
            type="button"
            onClick={() => setTab('drive')}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition sm:px-3.5',
              tab === 'drive'
                ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                : 'bg-muted/60 text-text-secondary hover:bg-muted hover:text-text-primary',
            )}
          >
            <FolderSync className="h-3.5 w-3.5" />
            Google Drive
          </button>
        </nav>
      </header>

      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6">
        {tab === 'drive' ? (
          <div className="min-w-0">
            <WorkspaceOpsConsole />
          </div>
        ) : (
          <WorkspaceDocumentsPanel />
        )}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <DocumentsPageInner />
    </Suspense>
  );
}
