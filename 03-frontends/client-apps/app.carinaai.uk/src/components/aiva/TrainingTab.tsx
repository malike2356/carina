'use client';

import { FileText, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PlanGateSection } from '@/components/billing/PlanGateSection';
import { Modal } from '@/components/ui/Modal';
import { ListSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useToast } from '@/components/ui/Toast';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { CarinaEditor } from '@/components/editor';
import { cn } from '@/lib/utils';

interface KnowledgeEntry {
  id: string;
  type: 'document' | 'faq';
  title: string;
  charCount: number;
  enabled: boolean;
  preview?: string;
}

function KnowledgeUsageBar({ usedChars, maxChars }: { usedChars: number; maxChars: number }) {
  const pct = Math.min(100, (usedChars / maxChars) * 100);
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-accent';
  return (
    <div className="rounded-lg border border-border bg-elevated p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-text-primary">Knowledge base usage</p>
        <p className="text-xs text-text-muted">
          {usedChars.toLocaleString()} / {maxChars.toLocaleString()} chars
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TrainingTab({ workerId }: { workerId: string }) {
  const { push } = useToast();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [usedChars, setUsedChars] = useState(0);
  const [maxChars, setMaxChars] = useState(50_000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');
  const [dragging, setDragging] = useState(false);
  const [planTier, setPlanTier] = useState('trial');
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/knowledge`);
      const body = (await res.json()) as {
        entries?: KnowledgeEntry[];
        usedChars?: number;
        maxChars?: number;
        planTier?: string;
        error?: string;
        code?: string;
      };
      if (res.status === 403 && body.code === 'PLAN_UPGRADE_REQUIRED') {
        setPlanTier(body.planTier ?? 'trial');
        setEntries([]);
        setUsedChars(0);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? 'Failed to load knowledge');
      setEntries(body.entries ?? []);
      setUsedChars(body.usedChars ?? 0);
      setMaxChars(body.maxChars ?? 50_000);
      setPlanTier(body.planTier ?? 'trial');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load knowledge';
      setError(msg);
      push(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [workerId, push]);

  useEffect(() => {
    void load();
  }, [load]);

  const docEntries = entries.filter((e) => e.type === 'document');
  const faqEntries = entries.filter((e) => e.type === 'faq');

  async function uploadFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const data = String(reader.result ?? '');
      const base64 = data.includes(',') ? data.split(',')[1] : data;
      const res = await fetch(`/api/aiva/workers/${workerId}/knowledge/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, title: file.name, data: base64 }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        const msg = body.error ?? 'Upload failed';
        setError(msg);
        push(msg, 'error');
        return;
      }
      push('Document uploaded', 'success');
      await load();
    };
    reader.readAsDataURL(file);
  }

  async function saveFaq() {
    const res = await fetch(`/api/aiva/workers/${workerId}/knowledge/faq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: faqQ, answer: faqA }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      const msg = body.error ?? 'Could not save FAQ';
      setError(msg);
      push(msg, 'error');
      return;
    }
    push('FAQ saved', 'success');
    setFaqQ('');
    setFaqA('');
    setShowFaqForm(false);
    await load();
  }

  async function toggleEntry(entryId: string, enabled: boolean) {
    await fetch(`/api/aiva/workers/${workerId}/knowledge/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    await load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/knowledge/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      push('Entry removed', 'success');
      setDeleteTarget(null);
      await load();
    } catch {
      push('Could not delete entry', 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <PlanGateSection planRequired="business" currentPlan={planTier}>
      <div className="space-y-6">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <KnowledgeUsageBar usedChars={usedChars} maxChars={maxChars} />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">Documents</h3>
          <label
            htmlFor="doc-upload"
            className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80"
          >
            <Upload className="h-3.5 w-3.5" />
            Add document
          </label>
          <input
            id="doc-upload"
            type="file"
            accept=".pdf,.docx,.txt"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
        </div>

        {docEntries.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void uploadFile(file);
            }}
            onClick={() => document.getElementById('doc-upload')?.click()}
            className={cn(
              'cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              dragging ? 'border-accent bg-accent-dim' : 'border-border hover:border-accent/40 hover:bg-elevated',
            )}
          >
            <Upload className="mx-auto mb-2 h-5 w-5 text-text-muted" />
            <p className="mb-0.5 text-sm text-text-secondary">Drop a file here or click to browse</p>
            <p className="text-[11px] text-text-muted">PDF, DOCX, or TXT. Max 5MB per file.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-elevated">
            {docEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-text-primary">{entry.title}</p>
                    <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[10px] text-accent">
                      Doc
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">{entry.charCount.toLocaleString()} chars</p>
                </div>
                <ToggleSwitch
                  checked={entry.enabled}
                  onChange={(next) => void toggleEntry(entry.id, next)}
                  label={`Toggle ${entry.title}`}
                />
                <button
                  type="button"
                  aria-label={`Delete document ${entry.title}`}
                  onClick={() => setDeleteTarget(entry)}
                  className="text-text-muted transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">FAQ pairs</h3>
          <button
            type="button"
            onClick={() => setShowFaqForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80"
          >
            <Plus className="h-3.5 w-3.5" />
            Add FAQ
          </button>
        </div>

        {showFaqForm ? (
          <div className="mb-3 space-y-3 rounded-xl border border-accent/30 bg-accent-dim/20 p-4">
            <input
              className={AIVA_INPUT_CLASS}
              value={faqQ}
              onChange={(e) => setFaqQ(e.target.value)}
              placeholder="Question"
            />
            <CarinaEditor
              value={faqA}
              onChange={setFaqA}
              placeholder="Answer"
              variant="compact"
              minHeight="5rem"
              showEngineSwitch={false}
            />
            <p
              className={cn(
                'text-[11px]',
                faqA.length > 500
                  ? 'text-red-400'
                  : faqA.length > 450
                    ? 'text-amber-400'
                    : 'text-text-muted',
              )}
            >
              {faqA.length} / 500 characters
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={faqQ.trim().length === 0 || faqA.trim().length === 0 || faqA.length > 500}
                onClick={() => void saveFaq()}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-text-primary disabled:opacity-50"
              >
                Save FAQ
              </button>
              <button
                type="button"
                onClick={() => setShowFaqForm(false)}
                className="text-xs text-text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {faqEntries.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border bg-elevated">
            {faqEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm text-text-primary">
                    <span className="mr-1 text-[10px] font-semibold uppercase text-text-muted">Q</span>
                    <span className="line-clamp-2">{entry.title}</span>
                  </p>
                  <p className="text-[11px] text-text-secondary">
                    <span className="mr-1 text-[10px] font-semibold uppercase text-text-muted">A</span>
                    <span className="line-clamp-3">{entry.preview ?? ''}</span>
                  </p>
                </div>
                <ToggleSwitch
                  checked={entry.enabled}
                  onChange={(next) => void toggleEntry(entry.id, next)}
                  label={`Toggle FAQ ${entry.title}`}
                />
                <button
                  type="button"
                  aria-label={`Delete FAQ ${entry.title}`}
                  onClick={() => setDeleteTarget(entry)}
                  className="text-text-muted transition-colors hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : !showFaqForm ? (
          <p className="text-xs text-text-muted">No FAQ pairs yet.</p>
        ) : null}
      </div>
      </div>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Remove knowledge entry?"
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.title}" from this Aiva's knowledge base.`
            : undefined
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void confirmDelete()}
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300"
            >
              {deleting ? 'Removing...' : 'Remove'}
            </button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">The Aiva will no longer use this content in replies.</p>
      </Modal>
    </PlanGateSection>
  );
}
