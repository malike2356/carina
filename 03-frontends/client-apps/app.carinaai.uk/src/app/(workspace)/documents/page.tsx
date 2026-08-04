'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderSync,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { WorkspaceOpsConsole } from '@/components/aiva/WorkspaceOpsConsole';
import { CoreSurfaceBanner } from '@/components/shell/CoreSurfaceBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { OriginBadge } from '@/components/ui/OriginBadge';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import { Spinner } from '@/components/ui/Spinner';
import { documentPreview, documentWordCount } from '@/lib/document-preview';
import { DOCUMENTS_ORIGIN_HELPER_TEXT, matchesOriginFilter, type OriginFilter } from '@/lib/sync-ownership';
import { cn } from '@/lib/utils';

interface DocumentRow {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

type DocumentsTab = 'workspace' | 'drive';
type DocumentsLayout = 'grid' | 'list';

const LAYOUT_STORAGE_KEY = 'aiva.documents.layout';
const PAGE_SIZE_GRID = 12;
const PAGE_SIZE_LIST = 20;

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
  const [layout, setLayout] = useState<DocumentsLayout>('grid');
  const [page, setPage] = useState(1);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored === 'grid' || stored === 'list') setLayout(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function changeLayout(next: DocumentsLayout) {
    setLayout(next);
    setPage(1);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesOriginFilter({ origin: 'local' }, originFilter)),
    [rows, originFilter],
  );

  const pageSize = layout === 'grid' ? PAGE_SIZE_GRID : PAGE_SIZE_LIST;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [originFilter]);

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
          <p className="break-words text-[11px] text-text-muted">
            Workspace docs are local until mirrored to Drive Ops. {DOCUMENTS_ORIGIN_HELPER_TEXT}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border border-border bg-elevated p-0.5"
            role="group"
            aria-label="Documents layout"
          >
            <button
              type="button"
              aria-pressed={layout === 'grid'}
              title="Grid view"
              onClick={() => changeLayout('grid')}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px]',
                layout === 'grid'
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              type="button"
              aria-pressed={layout === 'list'}
              title="List view"
              onClick={() => changeLayout('list')}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px]',
                layout === 'list'
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
          <IconButton label="Refresh" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            onClick={() => void createDocument()}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
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
        <>
          {layout === 'grid' ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pageRows.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative min-w-0 rounded-lg border border-border bg-surface transition-colors hover:border-accent/40 hover:bg-elevated"
                >
                  <Link href={`/documents/${doc.id}`} className="block p-4 pr-10">
                    <div className="mb-1 flex min-w-0 items-center gap-2">
                      <h2 className="min-w-0 truncate text-sm font-medium text-text-primary">
                        {doc.title}
                      </h2>
                      <span className="shrink-0">
                        <OriginBadge origin="local" />
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 break-words text-xs leading-relaxed text-text-muted">
                      {documentPreview(doc.content, 180)}
                    </p>
                    <p className="mt-3 text-[10px] text-text-muted">
                      {documentWordCount(doc.content)} words · Updated {formatDate(doc.updatedAt)}
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
          ) : (
            <div className="min-w-0 overflow-hidden rounded-lg border border-border">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_7rem_6rem_2.5rem] gap-3 border-b border-border bg-elevated px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted sm:grid">
                <span>Title</span>
                <span>Preview</span>
                <span>Updated</span>
                <span>Words</span>
                <span className="sr-only">Actions</span>
              </div>
              <ul className="divide-y divide-border">
                {pageRows.map((doc) => (
                  <li
                    key={doc.id}
                    className="group grid min-w-0 grid-cols-1 gap-2 px-3 py-3 transition-colors hover:bg-elevated/60 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_7rem_6rem_2.5rem] sm:items-center sm:gap-3"
                  >
                    <Link
                      href={`/documents/${doc.id}`}
                      className="min-w-0 font-medium text-text-primary hover:text-accent"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{doc.title}</span>
                        <OriginBadge origin="local" />
                      </span>
                    </Link>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="min-w-0 text-xs leading-relaxed text-text-muted hover:text-text-secondary"
                    >
                      <span className="line-clamp-2 break-words">
                        {documentPreview(doc.content, 220)}
                      </span>
                    </Link>
                    <p className="text-[11px] text-text-muted">{formatDate(doc.updatedAt)}</p>
                    <p className="text-[11px] text-text-muted">
                      {documentWordCount(doc.content)}
                    </p>
                    <div className="flex justify-end">
                      <IconButton
                        label="Delete document"
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
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-[11px] text-text-muted">
              {filteredRows.length} document{filteredRows.length === 1 ? '' : 's'}
              {totalPages > 1
                ? ` · Page ${currentPage} of ${totalPages}`
                : null}
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, index) => index + 1)
                  .filter((pageNumber) => {
                    if (totalPages <= 7) return true;
                    if (pageNumber === 1 || pageNumber === totalPages) return true;
                    return Math.abs(pageNumber - currentPage) <= 1;
                  })
                  .reduce<number[]>((acc, pageNumber, index, arr) => {
                    if (index > 0 && pageNumber - arr[index - 1]! > 1) acc.push(-pageNumber);
                    acc.push(pageNumber);
                    return acc;
                  }, [])
                  .map((pageNumber) =>
                    pageNumber < 0 ? (
                      <span key={`gap-${pageNumber}`} className="px-1 text-[11px] text-text-muted">
                        …
                      </span>
                    ) : (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        className={cn(
                          'min-w-7 rounded-md px-2 py-1 text-[11px]',
                          pageNumber === currentPage
                            ? 'bg-accent text-white'
                            : 'text-text-secondary hover:bg-elevated',
                        )}
                      >
                        {pageNumber}
                      </button>
                    ),
                  )}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </>
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
      <header className="shrink-0 border-b border-border px-3 py-4 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary">Documents</h1>
            <p className="text-xs text-text-muted">
              {tab === 'drive'
                ? 'Upload files to Google Drive and the document vault so Aiva can learn from them.'
                : 'Type freely; ask Carina inline to continue or polish your draft.'}
            </p>
          </div>
        </div>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Documents sections">
          <button
            type="button"
            onClick={() => setTab('workspace')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition',
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
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition',
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

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6">
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
