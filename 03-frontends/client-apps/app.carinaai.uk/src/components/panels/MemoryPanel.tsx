'use client';

import { useEffect, useState } from 'react';
import {
  Brain,
  Download,
  Edit2,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

interface Memory {
  id: string;
  content: string;
  type: string;
  enabled: boolean;
  source: string;
  confidence: number;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  fact: 'Fact',
  preference: 'Preference',
  instruction: 'Instruction',
  contact: 'Contact',
};

interface MemoryPanelProps {
  onClose: () => void;
  embedded?: boolean;
}

export function MemoryPanel({ onClose, embedded = true }: MemoryPanelProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'import'>('list');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<'fact' | 'preference' | 'instruction' | 'contact'>('fact');
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  async function load(query = '') {
    setLoading(true);
    const response = await fetch(`/api/memories${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    const data = await response.json();
    if (data.data) setMemories(data.data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load(search);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  async function addMemory() {
    if (!newContent.trim()) return;
    setSaving(true);
    const response = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent.trim(), type: newType }),
    });
    const data = await response.json();
    if (data.data) {
      setMemories((prev) => [data.data, ...prev]);
      setNewContent('');
      setActiveTab('list');
    }
    setSaving(false);
  }

  async function toggleEnabled(memory: Memory) {
    setMemories((prev) =>
      prev.map((item) => (item.id === memory.id ? { ...item, enabled: !item.enabled } : item)),
    );
    const response = await fetch(`/api/memories/${memory.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !memory.enabled }),
    });
    if (!response.ok) {
      setMemories((prev) =>
        prev.map((item) => (item.id === memory.id ? { ...item, enabled: memory.enabled } : item)),
      );
    }
  }

  async function deleteMemory(id: string) {
    const previous = memories;
    setMemories((prev) => prev.filter((memory) => memory.id !== id));
    const response = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
    if (!response.ok) setMemories(previous);
  }

  async function commitEdit(id: string) {
    if (!editDraft.trim()) return;
    const nextContent = editDraft.trim();
    await fetch(`/api/memories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: nextContent }),
    });
    setMemories((prev) =>
      prev.map((memory) => (memory.id === id ? { ...memory, content: nextContent } : memory)),
    );
    setEditingId(null);
  }

  async function doImport() {
    if (!importText.trim()) return;
    setImporting(true);
    const response = await fetch('/api/memories/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: importText }),
    });
    const data = await response.json();
    if (data.data) {
      setImportText('');
      setActiveTab('list');
      await load();
    }
    setImporting(false);
  }

  function exportMemories() {
    window.open('/api/memories/export', '_blank');
  }

  const tabs = [
    { id: 'list' as const, label: `Memories ${memories.length > 0 ? memories.length : ''}` },
    { id: 'add' as const, label: 'Add' },
    { id: 'import' as const, label: 'Import' },
  ];

  const body = (
    <>
      <div className="flex gap-1 border-b border-border px-4 pb-0 pt-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'border-b-2 px-3 pb-2.5 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary',
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 pb-2">
          <IconButton label="Export memories" size="sm" onClick={exportMemories}>
            <Download className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="flex flex-col">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search memories..."
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              {search && (
                <IconButton label="Clear search" size="sm" onClick={() => setSearch('')}>
                  <X className="h-3 w-3" />
                </IconButton>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : memories.length === 0 ? (
            <EmptyState
              icon={<Brain className="h-8 w-8" />}
              title="No memories yet"
              subtitle="Add facts, preferences, or instructions Carina should remember across conversations."
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-accent-hover"
                >
                  Add first memory
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className={cn(
                    'group px-4 py-3 transition-colors hover:bg-elevated',
                    !memory.enabled && 'opacity-50',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => toggleEnabled(memory)}
                      className="mt-0.5 shrink-0 text-text-muted transition-colors hover:text-accent"
                      aria-label={memory.enabled ? 'Disable memory' : 'Enable memory'}
                    >
                      {memory.enabled ? (
                        <ToggleRight className="h-4 w-4 text-accent" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      {editingId === memory.id ? (
                        <div className="flex flex-col gap-1.5">
                          <textarea
                            value={editDraft}
                            onChange={(event) => setEditDraft(event.target.value)}
                            autoFocus
                            rows={3}
                            className="w-full resize-none rounded border border-border-focus bg-elevated px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                void commitEdit(memory.id);
                              }
                              if (event.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => void commitEdit(memory.id)}
                              className="rounded bg-accent px-2 py-1 text-[10px] font-medium text-black"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded bg-elevated px-2 py-1 text-[10px] text-text-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="break-words text-xs leading-relaxed text-text-primary">
                          {memory.content}
                        </p>
                      )}

                      <div className="mt-1.5 flex items-center gap-2">
                        <MemoryTypeBadge type={memory.type} />
                        {memory.source === 'extracted' || memory.source === 'conversation' ? (
                          <span className="text-[10px] italic text-text-muted">auto-extracted</span>
                        ) : null}
                        {memory.source === 'imported' && (
                          <span className="text-[10px] italic text-text-muted">imported</span>
                        )}
                      </div>
                    </div>

                    {editingId !== memory.id && (
                      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                        <IconButton
                          label="Edit memory"
                          size="sm"
                          onClick={() => {
                            setEditingId(memory.id);
                            setEditDraft(memory.content);
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </IconButton>
                        <IconButton
                          label="Delete memory"
                          size="sm"
                          onClick={() => void deleteMemory(memory.id)}
                        >
                          <Trash2 className="h-3 w-3 text-danger" />
                        </IconButton>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Memory type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['fact', 'preference', 'instruction', 'contact'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewType(type)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    newType === type
                      ? 'border-accent/40 bg-accent-dim text-accent'
                      : 'border-border bg-elevated text-text-secondary hover:text-text-primary',
                  )}
                >
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Content
              <span className="ml-1 font-normal text-text-muted">
                {newType === 'fact' && '- a fact about you or your work'}
                {newType === 'preference' && '- how you prefer Carina to behave'}
                {newType === 'instruction' && '- a rule Carina must follow'}
                {newType === 'contact' && '- a person or organisation'}
              </span>
            </label>
            <textarea
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              placeholder={
                newType === 'fact'
                  ? 'e.g. I focus on buy-to-let properties in South Manchester'
                  : newType === 'preference'
                    ? 'e.g. Always respond concisely and avoid bullet lists unless asked'
                    : newType === 'instruction'
                      ? 'e.g. Never quote a rental yield below 5% as acceptable'
                      : 'e.g. Sarah Chen - tenant in Flat 2, lease ends March 2027'
              }
              rows={4}
              autoFocus
              className="w-full resize-none rounded-lg border border-border bg-elevated px-3 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.metaKey) void addMemory();
              }}
            />
            <p className="mt-1 text-[10px] text-text-muted">Cmd+Enter to save</p>
          </div>

          <button
            type="button"
            onClick={() => void addMemory()}
            disabled={saving || !newContent.trim()}
            className="w-full rounded-md bg-accent py-2 text-xs font-medium text-black transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Add memory'}
          </button>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-3 text-xs text-text-secondary">
              Paste text with one memory per line. Each line becomes a separate fact.
              You can also paste from a .txt or .md file.
            </p>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={
                'I prefer direct, concise answers\nMy target market is first-time buyers\nI work with solicitor: John Bramley at Bramley & Co'
              }
              rows={8}
              autoFocus
              className="w-full resize-none rounded-lg border border-border bg-elevated px-3 py-2.5 font-mono text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus"
            />
            <p className="mt-1 text-[10px] text-text-muted">
              {importText.split('\n').filter((line) => line.trim().length > 3).length} memories to import
            </p>
          </div>

          <button
            type="button"
            onClick={() => void doImport()}
            disabled={importing || !importText.trim()}
            className="w-full rounded-md bg-accent py-2 text-xs font-medium text-black transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {importing ? 'Importing...' : 'Import memories'}
          </button>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="flex h-full min-h-0 flex-col overflow-hidden">{body}</div>;
  }

  return (
    <Panel title="Memory" icon={<Brain className="h-4 w-4" />} onClose={onClose} width={380}>
      {body}
    </Panel>
  );
}

function MemoryTypeBadge({ type }: { type: string }) {
  if (type === 'instruction') return <Badge variant="running">{TYPE_LABELS[type]}</Badge>;
  if (type === 'preference') {
    return (
      <span className="rounded bg-purple-950 px-1.5 py-0.5 text-[10px] font-medium text-purple-400">
        {TYPE_LABELS[type]}
      </span>
    );
  }
  if (type === 'contact') {
    return (
      <span className="rounded bg-amber-950 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
        {TYPE_LABELS[type]}
      </span>
    );
  }

  return <Badge>{TYPE_LABELS[type] ?? type}</Badge>;
}
