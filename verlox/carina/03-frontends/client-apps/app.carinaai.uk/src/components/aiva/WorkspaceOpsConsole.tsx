'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FolderSync } from 'lucide-react';
import { WorkspaceOpsTab, type OpsSection } from '@/components/aiva/WorkspaceOpsTab';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type WorkerRow = { id: string; name: string; status?: string };

const SECTIONS: Array<{ id: OpsSection; label: string; hint: string }> = [
  { id: 'home', label: 'Home', hint: 'Status and shortcuts' },
  { id: 'capture', label: 'Record', hint: 'Minutes, attendance, reports' },
  { id: 'files', label: 'Files', hint: 'Synced Drive documents' },
  { id: 'setup', label: 'Setup', hint: 'Connect Drive and folders' },
];

function parseSection(raw: string | null): OpsSection {
  if (raw === 'overview' || raw === 'status') return 'home';
  if (raw === 'minutes' || raw === 'attendance' || raw === 'next-meeting' || raw === 'funder-month') {
    return 'capture';
  }
  if (raw === 'files' || raw === 'capture' || raw === 'setup' || raw === 'home') return raw;
  return 'home';
}

export function WorkspaceOpsConsole() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sectionParam = search.get('section');
  const section = parseSection(sectionParam);
  const captureKinds = ['minutes', 'attendance', 'next-meeting', 'funder-month'] as const;
  const captureHint =
    sectionParam && (captureKinds as readonly string[]).includes(sectionParam)
      ? (sectionParam as (typeof captureKinds)[number])
      : null;

  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [workerId, setWorkerId] = useState(search.get('workerId') ?? '');
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  const writeQuery = useCallback(
    (next: { section?: OpsSection | string; workerId?: string }) => {
      const params = new URLSearchParams(search.toString());
      if (next.section !== undefined) params.set('section', next.section);
      if (next.workerId !== undefined) {
        if (next.workerId) params.set('workerId', next.workerId);
        else params.delete('workerId');
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, search],
  );

  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    try {
      const res = await fetch('/api/aiva/workers');
      const body = (await res.json()) as { workers?: WorkerRow[] };
      const list = body.workers ?? [];
      setWorkers(list);
      const fromUrl = search.get('workerId') ?? '';
      const chosen = fromUrl && list.some((w) => w.id === fromUrl) ? fromUrl : list[0]?.id ?? '';
      setWorkerId(chosen);
      if (chosen && !fromUrl) {
        const params = new URLSearchParams(search.toString());
        params.set('workerId', chosen);
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      }
    } finally {
      setLoadingWorkers(false);
    }
  }, [pathname, router, search]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  const selected = workers.find((w) => w.id === workerId);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-text-primary">
            <FolderSync className="h-5 w-5 shrink-0 text-accent" aria-hidden />
            <h1 className="text-2xl font-semibold">Drive</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Keep meeting notes, attendance, and monthly reports in Google Drive and Aiva together.
            Pick an AI Employee, finish setup once, then record after each meeting.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-60">
          <label htmlFor="drive-ops-worker" className="block text-xs font-medium text-text-muted">
            AI Employee
          </label>
          <select
            id="drive-ops-worker"
            className={cn(
              AIVA_INPUT_CLASS,
              'mt-1 truncate bg-card text-sm shadow-sm',
            )}
            value={workerId}
            disabled={loadingWorkers || workers.length === 0}
            onChange={(e) => {
              const id = e.target.value;
              setWorkerId(id);
              writeQuery({ workerId: id });
            }}
          >
            {workers.length === 0 ? (
              <option value="">No employees yet</option>
            ) : (
              workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {workers.length > 0 ? (
        <nav className="flex flex-wrap gap-2 border-b border-border pb-3" aria-label="Drive sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => writeQuery({ section: s.id, workerId })}
              className={cn(
                'rounded-xl px-3.5 py-2 text-left text-sm transition',
                section === s.id
                  ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                  : 'bg-muted/60 text-text-secondary hover:bg-muted hover:text-text-primary',
              )}
              title={s.hint}
            >
              <span className="block font-medium">{s.label}</span>
              <span className="mt-0.5 hidden text-[11px] text-text-muted sm:block">{s.hint}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {!workerId ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
          <FolderSync className="mx-auto h-10 w-10 text-text-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-text-primary">Hire an AI Employee first</p>
          <p className="mt-1 text-sm text-text-muted">
            Drive sync runs through one employee who is connected to Google Drive.
          </p>
          <Link
            href="/aiva"
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-primary-foreground"
          >
            Hire AI Employee
          </Link>
        </div>
      ) : (
        <WorkspaceOpsTab
          workerId={workerId}
          workerName={selected?.name}
          section={section}
          initialCapture={captureHint}
          onRequestSection={(next) => writeQuery({ section: next, workerId })}
        />
      )}
    </div>
  );
}
