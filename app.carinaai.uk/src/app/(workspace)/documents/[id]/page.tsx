'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  MessageSquare,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { CoreSurfaceBanner } from '@/components/shell/CoreSurfaceBanner';
import { IconButton } from '@/components/ui/IconButton';
import { MarkdownContent } from '@/components/chat/MarkdownContent';
import { cn } from '@/lib/utils';

type AssistAction = 'format' | 'spellcheck' | 'factcheck';

export default function DocumentEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [assisting, setAssisting] = useState<AssistAction | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/documents/${params.id}`);
    const data = await res.json();
    if (!data.data) {
      router.push('/documents');
      return;
    }
    setTitle(data.data.title);
    setContent(data.data.content);
    setLoading(false);
  }, [params.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const persist = useCallback(
    async (nextTitle: string, nextContent: string) => {
      setSaving(true);
      setSaved(false);
      await fetch(`/api/documents/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: nextTitle, content: nextContent }),
      });
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    [params.id],
  );

  function scheduleSave(nextTitle: string, nextContent: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(nextTitle, nextContent), 1000);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    scheduleSave(value, content);
  }

  function handleContentChange(value: string) {
    setContent(value);
    scheduleSave(title, value);
  }

  async function runAssist(action: AssistAction) {
    setAssisting(action);
    const selection =
      typeof window !== 'undefined' ? window.getSelection()?.toString().trim() : '';
    const res = await fetch(`/api/documents/${params.id}/assist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        selection: selection || undefined,
        content: selection ? undefined : content,
      }),
    });
    const data = await res.json();
    setAssisting(null);
    if (!res.ok) {
      alert(data.error || 'Assist failed');
      return;
    }
    if (selection) {
      const nextContent = content.replace(selection, data.content);
      setContent(nextContent);
      scheduleSave(title, nextContent);
    } else {
      setContent(data.content);
      scheduleSave(title, data.content);
    }
  }

  function exportMarkdown() {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'document'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Link href="/documents" className="text-text-muted hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none"
          placeholder="Document title"
        />
        <div className="flex items-center gap-1 text-[10px] text-text-muted">
          {saving ? 'Saving...' : saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3" /> Saved
            </span>
          ) : (
            'Autosave on'
          )}
        </div>
        <IconButton label="Export markdown" onClick={exportMarkdown}>
          <Download className="h-4 w-4" />
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
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 flex-col border-r border-border">
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
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <CoreSurfaceBanner surface="documents" />
            {preview ? (
              <MarkdownContent content={content || '_Empty document_'} />
            ) : (
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="h-full min-h-[60vh] w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary outline-none"
                placeholder="Start typing. Carina will not ghost-write unless you ask for assist actions."
              />
            )}
          </div>
        </div>

        <aside className="w-72 shrink-0 overflow-y-auto p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            AI assist
          </p>
          <p className="mb-4 text-[11px] text-text-muted">
            Select text for targeted fixes, or run on the whole document.
          </p>
          <div className="space-y-2">
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
                disabled={assisting !== null}
                onClick={() => runAssist(action)}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-xs text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-50"
              >
                {assisting === action ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-accent" />
                )}
                {label}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
