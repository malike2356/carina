'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, FileText, RefreshCw, Search, StickyNote, FolderOpen } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { cn } from '@/lib/utils';

type WorkspaceFileKind = 'document' | 'note';

type WorkspaceFileItem = {
  id: string;
  kind: WorkspaceFileKind;
  title: string;
  content: string;
  archived: boolean;
  pinned: boolean;
  updatedAt: string;
  openHref: string | null;
};

type FilesResponse = {
  data?: {
    items: WorkspaceFileItem[];
    summary: { documents: number; notes: number; archived: number };
    root: string;
    source: string;
    includeArchived: boolean;
  };
  error?: string;
};

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

function kindLabel(kind: WorkspaceFileKind): string {
  return kind === 'document' ? 'Document' : 'Note';
}

function kindIcon(kind: WorkspaceFileKind): React.ReactNode {
  return kind === 'document' ? <FileText className="h-3.5 w-3.5" /> : <StickyNote className="h-3.5 w-3.5" />;
}

function downloadFile(title: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${title.trim().toLowerCase().replace(/\s+/g, '-') || 'file'}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function FilesPage() {
  const [items, setItems] = useState<WorkspaceFileItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ documents: 0, notes: 0, archived: 0 });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/files?archived=${includeArchived ? '1' : '0'}`, { cache: 'no-store' });
      const data = (await res.json()) as FilesResponse;
      if (!res.ok) throw new Error(data.error ?? 'Unable to load files');
      const next = data.data?.items ?? [];
      setItems(next);
      setSummary(data.data?.summary ?? { documents: 0, notes: 0, archived: 0 });
      if (next.length > 0) {
        setSelectedId((current) => (current && next.some((item) => item.id === current) ? current : next[0]!.id));
      } else {
        setSelectedId('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setItems([]);
      setSelectedId('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [includeArchived]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      return [item.title, item.content, item.kind].join(' ').toLowerCase().includes(needle);
    });
  }, [items, query]);

  const filteredItems = filtered;
  const selected = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null,
    [selectedId, filteredItems],
  );

  function exportSelected() {
    if (!selected) return;
    downloadFile(selected.title, selected.content);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary">Files</h1>
            <p className="text-xs text-text-muted">
              Workspace-managed files only. Newest 100 items from documents and notes. This page does not expose the host filesystem.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportSelected}
              disabled={!selected}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </header>

      <div className="border-b border-border bg-surface px-6 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
          <span>{summary.documents} documents</span>
          <span>{summary.notes} notes</span>
          <span>{summary.archived} archived</span>
          <label className="ml-auto flex min-w-64 flex-1 items-center gap-2 rounded-md border border-border bg-base px-3 py-2 text-xs text-text-secondary">
            <Search className="h-3.5 w-3.5" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search file content"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            Show archived
          </label>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="min-h-0 border-r border-border">
          <div className="min-h-0 overflow-y-auto p-4">
            {loading ? (
              <EmptyState title="Loading files" subtitle="Pulling workspace documents and notes." />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<FolderOpen className="h-8 w-8" />}
                title="No matching files"
                subtitle="Try a different search or include archived items."
              />
            ) : (
              <div className="space-y-2">
                {filtered.map((item) => (
                  <button
                    key={`${item.kind}:${item.id}`}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                      selected?.id === item.id
                        ? 'border-accent/30 bg-accent-dim'
                        : 'border-border bg-surface hover:bg-elevated',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-text-muted">{kindIcon(item.kind)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-text-primary">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-text-muted">{kindLabel(item.kind)}</span>
                          {item.archived ? (
                            <span className="text-[11px] text-amber-400">Archived</span>
                          ) : null}
                          {item.pinned ? (
                            <span className="text-[11px] text-accent">Pinned</span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                          {item.content.trim() || 'Empty file'}
                        </p>
                        <p className="mt-2 text-[11px] text-text-muted">
                          Updated {formatTime(item.updatedAt)}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-text-muted" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto">
          <div className="border-b border-border px-6 py-3">
            <h2 className="text-sm font-semibold text-text-primary">
              {selected ? selected.title : 'Preview'}
            </h2>
            <p className="text-[11px] text-text-muted">
              {selected
                ? `${kindLabel(selected.kind)} · Updated ${formatTime(selected.updatedAt)}`
                : 'Select a workspace file to preview it.'}
            </p>
          </div>

          <div className="space-y-4 p-6">
            {!selected ? (
              <EmptyState
                title="No file selected"
                subtitle="Pick a document or note from the list."
              />
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                    {kindIcon(selected.kind)}
                    {kindLabel(selected.kind)}
                  </span>
                  {selected.openHref ? (
                    <Link
                      href={selected.openHref}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-text-secondary hover:text-text-primary"
                    >
                      Open in Documents
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => document.dispatchEvent(new CustomEvent('open-panel', { detail: 'notes' }))}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-text-secondary hover:text-text-primary"
                    >
                      Open notes panel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={exportSelected}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-text-secondary hover:text-text-primary"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </button>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <MarkdownContent content={selected.content || '_Empty file_'} />
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
