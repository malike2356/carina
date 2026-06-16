'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Plus, RefreshCw } from 'lucide-react';
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

export default function DocumentsPage() {
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Documents</h1>
          <p className="text-xs text-text-muted">You write; Carina assists with formatting and checks.</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Refresh" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </IconButton>
          <button
            type="button"
            onClick={createDocument}
            disabled={creating}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
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
            subtitle="Create a document and type freely. Ask Carina to fix formatting, spelling, or fact-check a selection."
            action={
              <button
                type="button"
                onClick={createDocument}
                className="rounded-md bg-accent px-3 py-1.5 text-xs text-white"
              >
                Create document
              </button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/40 hover:bg-elevated"
              >
                <h2 className="truncate text-sm font-medium text-text-primary">{doc.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                  {doc.content.trim() || 'Empty document'}
                </p>
                <p className="mt-3 text-[10px] text-text-muted">
                  {wordCount(doc.content)} words · Updated {formatDate(doc.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
