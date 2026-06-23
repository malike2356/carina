'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  FileText,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  archived: boolean;
  updatedAt: string;
}

interface NotesPanelProps {
  onClose: () => void;
  activeSessionId?: string | null;
  pinnedNoteIds?: Set<string>;
  onPinToggle?: (noteId: string, label: string, content: string) => void;
  embedded?: boolean;
}

type View = 'list' | 'edit' | 'new';

export function NotesPanel({
  onClose,
  activeSessionId,
  pinnedNoteIds = new Set(),
  onPinToggle,
  embedded = true,
}: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (showArchived) params.set('archived', '1');
    const response = await fetch(`/api/notes?${params}`);
    const data = await response.json();
    if (data.data) setNotes(data.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, showArchived]);

  function openNew() {
    setEditingNote(null);
    setEditTitle('');
    setEditContent('');
    setView('new');
    window.setTimeout(() => contentRef.current?.focus(), 50);
  }

  function openEdit(note: Note) {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setView('edit');
    window.setTimeout(() => contentRef.current?.focus(), 50);
  }

  async function saveNote() {
    if (!editContent.trim() && !editTitle.trim()) return;
    setSaving(true);
    const title = editTitle || editContent.split('\n')[0]?.slice(0, 60) || 'Untitled note';

    if (view === 'new') {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: editContent }),
      });
      const data = await response.json();
      if (data.data) {
        setNotes((prev) => [data.data, ...prev]);
        setView('list');
      }
    } else if (editingNote) {
      await fetch(`/api/notes/${editingNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: editContent }),
      });
      setNotes((prev) =>
        prev.map((note) =>
          note.id === editingNote.id ? { ...note, title, content: editContent } : note,
        ),
      );
      setView('list');
    }

    setSaving(false);
  }

  async function togglePinned(note: Note) {
    const pinned = !note.pinned;
    setNotes((prev) => prev.map((item) => (item.id === note.id ? { ...item, pinned } : item)));
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    });
  }

  async function toggleArchived(note: Note) {
    const archived = !note.archived;
    setNotes((prev) => prev.map((item) => (item.id === note.id ? { ...item, archived } : item)));
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived }),
    });
  }

  async function deleteNote(id: string) {
    const previous = notes;
    setNotes((prev) => prev.filter((note) => note.id !== id));
    const response = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!response.ok) setNotes(previous);
  }

  const pinnedNotes = notes.filter((note) => note.pinned && !note.archived);
  const regularNotes = notes.filter((note) => !note.pinned && !note.archived);
  const archivedNotes = notes.filter((note) => note.archived);

  const body = (
    <>
      {view === 'list' && (
        <div className="flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search notes..."
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <IconButton label="New note" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="px-4 pb-2">
            <button
              type="button"
              onClick={() => setShowArchived((value) => !value)}
              className="text-[10px] text-text-muted transition-colors hover:text-text-secondary"
            >
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : notes.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-8 w-8" />}
              title="No notes yet"
              subtitle="Create notes to pin as context to your chat sessions."
              action={
                <button
                  type="button"
                  onClick={openNew}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover"
                >
                  New note
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {pinnedNotes.length > 0 && (
                <>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Pinned
                  </p>
                  {pinnedNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      activeSessionId={activeSessionId}
                      pinnedNoteIds={pinnedNoteIds}
                      onPinToggle={onPinToggle}
                      onEdit={openEdit}
                      onTogglePinned={togglePinned}
                      onToggleArchived={toggleArchived}
                      onDelete={deleteNote}
                    />
                  ))}
                </>
              )}

              {regularNotes.length > 0 && (
                <>
                  {pinnedNotes.length > 0 && (
                    <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Notes
                    </p>
                  )}
                  {regularNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      activeSessionId={activeSessionId}
                      pinnedNoteIds={pinnedNoteIds}
                      onPinToggle={onPinToggle}
                      onEdit={openEdit}
                      onTogglePinned={togglePinned}
                      onToggleArchived={toggleArchived}
                      onDelete={deleteNote}
                    />
                  ))}
                </>
              )}

              {showArchived && archivedNotes.length > 0 && (
                <>
                  <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Archived
                  </p>
                  {archivedNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      activeSessionId={activeSessionId}
                      pinnedNoteIds={pinnedNoteIds}
                      onPinToggle={onPinToggle}
                      onEdit={openEdit}
                      onTogglePinned={togglePinned}
                      onToggleArchived={toggleArchived}
                      onDelete={deleteNote}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {(view === 'edit' || view === 'new') && (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <button
              type="button"
              onClick={() => setView('list')}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Notes
            </button>
            <span className="ml-auto text-xs text-text-muted">
              {view === 'new' ? 'New note' : 'Edit note'}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4">
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="Title (optional)"
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
            <textarea
              ref={contentRef}
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              placeholder="Write in markdown..."
              className="min-h-64 flex-1 resize-none rounded-md border border-border bg-elevated px-3 py-2.5 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
              onKeyDown={(event) => {
                if (event.key === 's' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void saveNote();
                }
              }}
            />
            <p className="text-[10px] text-text-muted">Ctrl+S to save - Markdown supported</p>
            <button
              type="button"
              onClick={() => void saveNote()}
              disabled={saving || (!editContent.trim() && !editTitle.trim())}
              className="rounded-md bg-accent py-2 text-xs font-medium text-black transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Save note'}
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col overflow-hidden">{body}</div>;
  }

  return (
    <Panel title="Notes" icon={<FileText className="h-4 w-4" />} onClose={onClose} width={400}>
      {body}
    </Panel>
  );
}

interface NoteRowProps {
  note: Note;
  activeSessionId?: string | null;
  pinnedNoteIds: Set<string>;
  onPinToggle?: (noteId: string, label: string, content: string) => void;
  onEdit: (note: Note) => void;
  onTogglePinned: (note: Note) => void;
  onToggleArchived: (note: Note) => void;
  onDelete: (id: string) => void;
}

function NoteRow({
  note,
  activeSessionId,
  pinnedNoteIds,
  onPinToggle,
  onEdit,
  onTogglePinned,
  onToggleArchived,
  onDelete,
}: NoteRowProps) {
  const isContextPinned = pinnedNoteIds.has(note.id);
  const preview = note.content.replace(/[#*`>-]/g, '').trim().slice(0, 100);

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-elevated',
        note.archived && 'opacity-50',
      )}
      onClick={() => onEdit(note)}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text-primary">{note.title}</p>
        {preview && <p className="mt-0.5 line-clamp-2 text-[11px] text-text-muted">{preview}</p>}
      </div>

      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex" onClick={(event) => event.stopPropagation()}>
        {activeSessionId && onPinToggle && (
          <IconButton
            label={isContextPinned ? 'Remove from context' : 'Add to chat context'}
            size="sm"
            onClick={() => onPinToggle(note.id, note.title, note.content)}
          >
            <ChevronRight className={cn('h-3 w-3', isContextPinned ? 'text-accent' : 'text-text-muted')} />
          </IconButton>
        )}
        <IconButton label={note.pinned ? 'Unpin' : 'Pin to top'} size="sm" onClick={() => onTogglePinned(note)}>
          {note.pinned ? <PinOff className="h-3 w-3 text-accent" /> : <Pin className="h-3 w-3" />}
        </IconButton>
        <IconButton
          label={note.archived ? 'Unarchive' : 'Archive'}
          size="sm"
          onClick={() => onToggleArchived(note)}
        >
          <Archive className="h-3 w-3" />
        </IconButton>
        <IconButton label="Delete note" size="sm" onClick={() => onDelete(note.id)}>
          <Trash2 className="h-3 w-3 text-danger" />
        </IconButton>
      </div>
    </div>
  );
}
