'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderSync,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { WorkspaceOpsConsole } from '@/components/aiva/WorkspaceOpsConsole';
import { DocumentVaultDrivePanel } from '@/components/documents/DocumentVaultDrivePanel';
import { CoreSurfaceBanner } from '@/components/shell/CoreSurfaceBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Spinner } from '@/components/ui/Spinner';
import {
  kindLabel,
  validateVaultMove,
  vaultEditorHref,
  type MoveValidationInput,
} from '@/lib/document-vault/vault-helpers';
import { cn } from '@/lib/utils';

type VaultKind =
  | 'folder'
  | 'rich_document'
  | 'spreadsheet'
  | 'presentation'
  | 'markdown'
  | 'html'
  | 'plain_text'
  | 'pdf'
  | 'binary_upload';

type VaultItem = {
  id: string;
  parentId: string | null;
  kind: VaultKind;
  name: string;
  byteSize: number;
  currentRevision: number;
  favorite: boolean;
  trashedAt: string | null;
  updatedAt: string;
  syncStatus?: string | null;
  conflict?: boolean;
};

type Breadcrumb = { id: string; name: string };

type LayoutMode = 'grid' | 'list';
type ViewMode = 'browse' | 'trash' | 'favorites' | 'drive';

const LAYOUT_KEY = 'aiva.vault.layout';
const CREATE_KINDS: Array<{ kind: VaultKind; label: string }> = [
  { kind: 'folder', label: 'Folder' },
  { kind: 'html', label: 'Rich document' },
  { kind: 'markdown', label: 'Markdown' },
  { kind: 'plain_text', label: 'Plain text' },
  { kind: 'spreadsheet', label: 'Spreadsheet (CSV)' },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ItemIcon({ kind, open }: { kind: string; open?: boolean }) {
  if (kind === 'folder') {
    return open ? <FolderOpen className="h-4 w-4 text-accent" /> : <Folder className="h-4 w-4 text-accent" />;
  }
  return <FileText className="h-4 w-4 text-text-muted" />;
}

export function DocumentVaultExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view: ViewMode =
    searchParams.get('tab') === 'drive'
      ? 'drive'
      : searchParams.get('view') === 'trash'
        ? 'trash'
        : searchParams.get('view') === 'favorites'
          ? 'favorites'
          : 'browse';

  const parentFromUrl = searchParams.get('folder');
  const [parentId, setParentId] = useState<string | null>(parentFromUrl);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [treeFolders, setTreeFolders] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<LayoutMode>('list');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const migratedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_KEY);
      if (stored === 'grid' || stored === 'list') setLayout(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setParentId(parentFromUrl);
  }, [parentFromUrl]);

  const setView = useCallback(
    (next: ViewMode, folderId?: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('tab');
      params.delete('view');
      params.delete('folder');
      if (next === 'drive') params.set('tab', 'drive');
      else if (next === 'trash') params.set('view', 'trash');
      else if (next === 'favorites') params.set('view', 'favorites');
      if (next === 'browse' && folderId) params.set('folder', folderId);
      const qs = params.toString();
      router.replace(qs ? `/documents?${qs}` : '/documents');
    },
    [router, searchParams],
  );

  const load = useCallback(async () => {
    if (view === 'drive') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!migratedRef.current) {
        await fetch('/api/vault/items?migrate=1', { cache: 'no-store' });
        migratedRef.current = true;
      }
      const params = new URLSearchParams();
      if (view === 'trash') params.set('scope', 'trash');
      else if (view === 'favorites') params.set('scope', 'favorites');
      else if (parentId) params.set('parentId', parentId);
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/vault/items?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to load vault');
      const nextItems: VaultItem[] = data.data?.items ?? [];
      setItems(nextItems);
      setBreadcrumbs(data.data?.breadcrumbs ?? []);

      const treeRes = await fetch('/api/vault/items?scope=all', { cache: 'no-store' });
      const treeData = await treeRes.json();
      setTreeFolders(
        ((treeData.data?.items ?? []) as VaultItem[]).filter(
          (item) => item.kind === 'folder' && !item.trashedAt,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [parentId, query, view]);

  useEffect(() => {
    void load();
  }, [load]);

  function changeLayout(next: LayoutMode) {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* ignore */
    }
  }

  async function createItem(kind: VaultKind) {
    setCreating(true);
    setCreateOpen(false);
    const res = await fetch('/api/vault/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        name: kind === 'folder' ? 'New folder' : 'Untitled',
        parentId: view === 'browse' ? parentId : null,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      setStatusNote(data.error ?? 'Create failed');
      return;
    }
    const item = data.data as VaultItem;
    if (item.kind === 'folder') {
      await load();
      return;
    }
    const href = vaultEditorHref(item);
    if (href) router.push(href);
  }

  async function trashSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Move ${ids.length} item(s) to trash?`)) return;
    for (const id of ids) {
      await fetch(`/api/vault/items/${id}`, { method: 'DELETE' });
    }
    setSelected(new Set());
    await load();
  }

  async function restoreItem(id: string) {
    setBusyId(id);
    await fetch(`/api/vault/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore' }),
    });
    setBusyId(null);
    await load();
  }

  async function toggleFavorite(item: VaultItem) {
    setBusyId(item.id);
    await fetch(`/api/vault/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'favorite', favorite: !item.favorite }),
    });
    setBusyId(null);
    await load();
  }

  async function renameItem(item: VaultItem) {
    const next = window.prompt('Rename', item.name);
    if (!next || next === item.name) return;
    setBusyId(item.id);
    const res = await fetch(`/api/vault/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', name: next }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json();
      setStatusNote(data.error ?? 'Rename failed');
      return;
    }
    await load();
  }

  async function moveItem(itemId: string, newParentId: string | null, snapshot: VaultItem[]) {
    const item = snapshot.find((row) => row.id === itemId);
    if (!item) return;
    const parent =
      newParentId == null
        ? undefined
        : snapshot.find((row) => row.id === newParentId) ??
          treeFolders.find((row) => row.id === newParentId) ??
          undefined;
    if (parent || newParentId == null) {
      const check = validateVaultMove({
        itemId,
        newParentId,
        parent: parent ? { kind: parent.kind, trashedAt: parent.trashedAt } : undefined,
        descendantIds: snapshot.filter((row) => row.parentId === itemId).map((row) => row.id),
      } satisfies MoveValidationInput);
      if (!check.ok) {
        setStatusNote(check.error);
        return;
      }
    }

    setItems((current) =>
      current.map((row) => (row.id === itemId ? { ...row, parentId: newParentId } : row)).filter((row) => {
        if (view !== 'browse') return true;
        return (row.parentId ?? null) === (parentId ?? null) || row.id === itemId;
      }),
    );

    const res = await fetch(`/api/vault/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'move', parentId: newParentId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setStatusNote(data.error ?? 'Move failed; restored previous location');
      setItems(snapshot);
      return;
    }
    setStatusNote(null);
    await load();
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = [...files];
    for (const file of list) {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      let kind: VaultKind = 'plain_text';
      if (lower.endsWith('.md')) kind = 'markdown';
      else if (lower.endsWith('.html') || lower.endsWith('.htm')) kind = 'html';
      else if (lower.endsWith('.csv')) kind = 'spreadsheet';
      else if (lower.endsWith('.pdf')) kind = 'pdf';
      await fetch('/api/vault/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          name: file.name,
          parentId: view === 'browse' ? parentId : null,
          content: kind === 'pdf' ? '' : text,
        }),
      });
    }
    await load();
  }

  const visibleItems = useMemo(() => {
    if (view === 'trash') return items.filter((item) => item.trashedAt);
    if (view === 'favorites') return items.filter((item) => item.favorite && !item.trashedAt);
    return items.filter((item) => !item.trashedAt);
  }, [items, view]);

  function openItem(item: VaultItem) {
    if (item.kind === 'folder') {
      setView('browse', item.id);
      return;
    }
    const href = vaultEditorHref(item);
    if (href) router.push(href);
  }

  function onDragStart(event: React.DragEvent, item: VaultItem) {
    event.dataTransfer.setData('application/x-vault-item', item.id);
    event.dataTransfer.effectAllowed = 'move';
  }

  function onDragOverFolder(event: React.DragEvent, folderId: string | null) {
    event.preventDefault();
    setDragOverId(folderId ?? 'root');
  }

  function onDropOnFolder(event: React.DragEvent, folderId: string | null) {
    event.preventDefault();
    setDragOverId(null);
    const itemId = event.dataTransfer.getData('application/x-vault-item');
    if (itemId) {
      void moveItem(itemId, folderId, items);
      return;
    }
    if (event.dataTransfer.files?.length) {
      void uploadFiles(event.dataTransfer.files);
    }
  }

  function toggleSelect(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (view === 'drive') {
    return (
      <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
        <header className="shrink-0 border-b border-border px-3 py-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-text-primary">Document Vault</h1>
              <p className="text-xs text-text-muted">
                Google Drive OAuth, sync modes, and conflict-safe reconciliation for the vault.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setView('browse')}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
            >
              Back to vault
            </button>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto px-3 py-4 sm:px-6">
          <DocumentVaultDrivePanel />
          <details className="rounded-lg border border-border bg-surface p-3">
            <summary className="cursor-pointer text-xs font-medium text-text-secondary">
              Legacy Workspace Ops Drive console
            </summary>
            <div className="mt-3 min-w-0">
              <WorkspaceOpsConsole />
            </div>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
      <header className="shrink-0 border-b border-border px-3 py-4 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary">Document Vault</h1>
            <p className="text-xs text-text-muted">
              Nested folders, editors, trash, and drag-and-drop moves. Server validates every move.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search this folder"
                className="h-8 w-44 rounded-md border border-border bg-elevated pl-7 pr-2 text-xs outline-none focus:border-accent"
              />
            </div>
            <div className="inline-flex rounded-md border border-border bg-elevated p-0.5" role="group" aria-label="Layout">
              <button
                type="button"
                aria-pressed={layout === 'grid'}
                onClick={() => changeLayout('grid')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px]',
                  layout === 'grid' ? 'bg-accent/15 text-accent' : 'text-text-muted',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </button>
              <button
                type="button"
                aria-pressed={layout === 'list'}
                onClick={() => changeLayout('list')}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px]',
                  layout === 'list' ? 'bg-accent/15 text-accent' : 'text-text-muted',
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
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-elevated"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) void uploadFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <div className="relative">
              <button
                type="button"
                disabled={creating}
                onClick={() => setCreateOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {creating ? <Spinner size="sm" /> : <Plus className="h-3.5 w-3.5" />}
                New
              </button>
              {createOpen ? (
                <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-border bg-surface p-1 shadow-lg">
                  {CREATE_KINDS.map((entry) => (
                    <button
                      key={entry.kind}
                      type="button"
                      className="block w-full rounded px-2 py-1.5 text-left text-xs text-text-primary hover:bg-elevated"
                      onClick={() => void createItem(entry.kind)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Vault sections">
          {(
            [
              ['browse', 'Browse'],
              ['favorites', 'Favorites'],
              ['trash', 'Trash'],
              ['drive', 'Google Drive'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition',
                view === key
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'bg-muted/60 text-text-secondary hover:bg-muted hover:text-text-primary',
              )}
            >
              {key === 'drive' ? <FolderSync className="h-3.5 w-3.5" /> : null}
              {key === 'favorites' ? <Star className="h-3.5 w-3.5" /> : null}
              {key === 'trash' ? <Trash2 className="h-3.5 w-3.5" /> : null}
              {label}
            </button>
          ))}
        </nav>

        {view === 'browse' ? (
          <nav className="mt-3 flex flex-wrap items-center gap-1 text-xs text-text-muted" aria-label="Breadcrumb">
            <button
              type="button"
              className={cn(
                'rounded px-1.5 py-0.5 hover:bg-elevated hover:text-text-primary',
                dragOverId === 'root' && 'bg-accent/15 text-accent',
              )}
              onClick={() => setView('browse', null)}
              onDragOver={(event) => onDragOverFolder(event, null)}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(event) => onDropOnFolder(event, null)}
            >
              Vault root
            </button>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.id} className="inline-flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button
                  type="button"
                  className={cn(
                    'rounded px-1.5 py-0.5 hover:bg-elevated hover:text-text-primary',
                    dragOverId === crumb.id && 'bg-accent/15 text-accent',
                  )}
                  onClick={() => setView('browse', crumb.id)}
                  onDragOver={(event) => onDragOverFolder(event, crumb.id)}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(event) => onDropOnFolder(event, crumb.id)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-border p-3 md:block">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Folders</p>
          <button
            type="button"
            className={cn(
              'mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs',
              !parentId && view === 'browse' ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-elevated',
              dragOverId === 'root' && 'ring-1 ring-accent',
            )}
            onClick={() => setView('browse', null)}
            onDragOver={(event) => onDragOverFolder(event, null)}
            onDrop={(event) => onDropOnFolder(event, null)}
          >
            <Folder className="h-3.5 w-3.5" />
            Root
          </button>
          {treeFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={cn(
                'mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs',
                parentId === folder.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-elevated',
                dragOverId === folder.id && 'ring-1 ring-accent',
              )}
              onClick={() => setView('browse', folder.id)}
              onDragOver={(event) => onDragOverFolder(event, folder.id)}
              onDrop={(event) => onDropOnFolder(event, folder.id)}
            >
              <Folder className="h-3.5 w-3.5" />
              <span className="truncate">{folder.name}</span>
            </button>
          ))}
        </aside>

        <div
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6"
          onDragOver={(event) => {
            event.preventDefault();
            setDragOverId(parentId ?? 'root');
          }}
          onDrop={(event) => onDropOnFolder(event, parentId)}
        >
          <CoreSurfaceBanner surface="documents" />

          {statusNote ? (
            <div className="mb-3 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
              {statusNote}
            </div>
          ) : null}

          {selected.size > 0 && view !== 'trash' ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2 text-xs">
              <span>{selected.size} selected</span>
              <button
                type="button"
                onClick={() => void trashSelected()}
                className="rounded-md border border-border px-2 py-1 text-danger hover:bg-surface"
              >
                Move to trash
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="text-text-muted hover:text-text-primary">
                Clear
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : error ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="Could not load Document Vault"
              subtitle={error}
              action={
                <button type="button" onClick={() => void load()} className="rounded-md bg-accent px-3 py-1.5 text-xs text-white">
                  Retry
                </button>
              }
            />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="h-8 w-8" />}
              title={view === 'trash' ? 'Trash is empty' : view === 'favorites' ? 'No favorites yet' : 'This folder is empty'}
              subtitle={
                view === 'browse'
                  ? 'Create a folder or document, or drop files here to upload.'
                  : 'Nothing to show in this view.'
              }
              action={
                view === 'browse' ? (
                  <button
                    type="button"
                    onClick={() => void createItem('html')}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs text-white"
                  >
                    Create document
                  </button>
                ) : undefined
              }
            />
          ) : layout === 'grid' ? (
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  draggable={view === 'browse'}
                  onDragStart={(event) => onDragStart(event, item)}
                  onDragOver={
                    item.kind === 'folder' ? (event) => onDragOverFolder(event, item.id) : undefined
                  }
                  onDrop={item.kind === 'folder' ? (event) => onDropOnFolder(event, item.id) : undefined}
                  className={cn(
                    'group relative min-w-0 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-accent/40',
                    dragOverId === item.id && 'border-accent bg-accent/5',
                    selected.has(item.id) && 'ring-1 ring-accent',
                  )}
                >
                  <div className="mb-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.name}`}
                      className="mt-1"
                    />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openItem(item)}>
                      <div className="mb-1 flex items-center gap-2">
                        <ItemIcon kind={item.kind} />
                        <span className="truncate text-sm font-medium text-text-primary">{item.name}</span>
                      </div>
                      <p className="text-[10px] text-text-muted">
                        {kindLabel(item.kind)} · {formatDate(item.updatedAt)}
                        {item.conflict ? ' · Conflict' : ''}
                        {item.syncStatus ? ` · ${item.syncStatus}` : ''}
                      </p>
                    </button>
                  </div>
                  {item.conflict ? (
                    <div className="mb-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-0.5 text-[10px]"
                        onClick={() =>
                          void fetch(`/api/vault/google/conflicts/${item.id}/resolve`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ choice: 'local' }),
                          }).then(() => load())
                        }
                      >
                        Keep local
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-0.5 text-[10px]"
                        onClick={() =>
                          void fetch(`/api/vault/google/conflicts/${item.id}/resolve`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ choice: 'google' }),
                          }).then(() => load())
                        }
                      >
                        Keep Google
                      </button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-1">
                    {view === 'trash' ? (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void restoreItem(item.id)}
                        className="rounded border border-border px-2 py-0.5 text-[10px]"
                      >
                        Restore
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void toggleFavorite(item)}
                          className="rounded border border-border px-2 py-0.5 text-[10px]"
                        >
                          {item.favorite ? 'Unstar' : 'Star'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void renameItem(item)}
                          className="rounded border border-border px-2 py-0.5 text-[10px]"
                        >
                          Rename
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-w-0 overflow-hidden rounded-lg border border-border">
              <ul className="divide-y divide-border">
                {visibleItems.map((item) => (
                  <li
                    key={item.id}
                    draggable={view === 'browse'}
                    onDragStart={(event) => onDragStart(event, item)}
                    onDragOver={
                      item.kind === 'folder' ? (event) => onDragOverFolder(event, item.id) : undefined
                    }
                    onDrop={item.kind === 'folder' ? (event) => onDropOnFolder(event, item.id) : undefined}
                    className={cn(
                      'flex min-w-0 items-center gap-3 px-3 py-2.5 hover:bg-elevated/60',
                      dragOverId === item.id && 'bg-accent/5',
                      selected.has(item.id) && 'bg-accent/5',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select ${item.name}`}
                    />
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => openItem(item)}>
                      <ItemIcon kind={item.kind} />
                      <span className="min-w-0 truncate text-sm text-text-primary">{item.name}</span>
                      <span className="shrink-0 text-[10px] text-text-muted">{kindLabel(item.kind)}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-text-muted">{formatDate(item.updatedAt)}</span>
                    </button>
                    {view === 'trash' ? (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void restoreItem(item.id)}
                        className="rounded border border-border px-2 py-1 text-[10px]"
                      >
                        Restore
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <IconButton label={item.favorite ? 'Unstar' : 'Star'} onClick={() => void toggleFavorite(item)}>
                          <Star className={cn('h-3.5 w-3.5', item.favorite && 'fill-accent text-accent')} />
                        </IconButton>
                        <Link
                          href={vaultEditorHref(item) ?? '#'}
                          className={cn(
                            'rounded border border-border px-2 py-1 text-[10px]',
                            item.kind === 'folder' && 'pointer-events-none opacity-40',
                          )}
                          onClick={(event) => {
                            if (item.kind === 'folder') event.preventDefault();
                          }}
                        >
                          Open
                        </Link>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
