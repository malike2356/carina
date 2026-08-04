'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { CoreSurfaceBanner } from '@/components/shell/CoreSurfaceBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';

interface DocumentRow {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

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

export default function DocumentsListView() {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  async function load() {
    setLoading(true);
    const res = await fetch('/api/documents');
    const data = await res.json();
    if (data.data) setRows(data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
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
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Documents</h1>
          <p className="text-xs text-text-muted">Type freely; ask Carina inline to continue or polish your draft.</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Refresh" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            onClick={createDocument}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {creating ? <Spinner size="sm" /> : <Plus className="h-3.5 w-3.5" />}
            New document
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <CoreSurfaceBanner surface="documents" />

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No documents yet"
            subtitle="Create a document and type freely. Use the inline Carina bar to write the next paragraph or expand your ideas."
            action={
              <button
                type="button"
                onClick={createDocument}
                className="rounded-md bg-accent px-3 py-1.5 text-xs text-primary-foreground"
              >
                Create document
              </button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((doc) => (
              <div
                key={doc.id}
                className="group relative rounded-lg border border-border bg-surface transition-colors hover:border-accent/40 hover:bg-elevated"
              >
                <Link href={`/documents/${doc.id}`} className="block p-4 pr-10">
                  <h2 className="truncate text-sm font-medium text-text-primary">{doc.title}</h2>
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
      </div>
    </div>
  );
}
