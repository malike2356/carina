'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ExternalLink,
  FolderSync,
  Link2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AIVA_INPUT_CLASS, formatTimestamp } from '@/lib/aiva-utils';
import {
  DOCUMENTS_ORIGIN_HELPER_TEXT,
  classifyDocumentOrigin,
  matchesOriginFilter,
  type OriginFilter,
} from '@/lib/sync-ownership';
import { cn } from '@/lib/utils';
import { OriginBadge } from '@/components/ui/OriginBadge';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import { Spinner } from '@/components/ui/Spinner';

export type OpsSection = 'home' | 'capture' | 'files' | 'setup';

type CaptureKind = 'minutes' | 'attendance' | 'next-meeting' | 'funder-month';

type OpsPackProfile = 'default' | 'community-sessions';

type OpsBinding = {
  orgName?: string;
  rootFolderId?: string;
  rootFolderName?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  enabled?: boolean;
  meta?: Record<string, unknown>;
};

type OpsFolder = {
  category: string;
  folderId: string;
  folderName: string;
};

type OpsSyncRun = {
  status?: string;
  pulled?: number;
  pushed?: number;
  conflicts?: number;
  error?: string | null;
  finishedAt?: string | null;
  startedAt?: string;
};

type OpsStatus = {
  bootstrapped?: boolean;
  binding?: OpsBinding | null;
  packProfile?: OpsPackProfile;
  folders?: OpsFolder[];
  mappingCount?: number;
  lastRun?: OpsSyncRun | null;
  error?: string;
  requiredPlan?: string;
  currentPlan?: string;
};

type OpsDocument = {
  id: string;
  title: string;
  category?: string;
  syncStatus?: string;
  driveWebViewLink?: string | null;
  charCount?: number;
  createdAt?: string;
  preview?: string;
};

const DEFAULT_CAPTURE_OPTIONS: Array<{ id: CaptureKind; label: string; hint: string }> = [
  { id: 'minutes', label: 'Minutes', hint: 'Meeting notes to Drive and Aiva' },
  { id: 'attendance', label: 'Attendance sheet', hint: 'Present and apologies only' },
  { id: 'next-meeting', label: 'Next meeting', hint: 'When, who, agenda' },
  { id: 'funder-month', label: 'Monthly funder report', hint: 'End-of-month evidence pack' },
];

const COMMUNITY_CAPTURE_OPTIONS: Array<{ id: CaptureKind; label: string; hint: string }> = [
  { id: 'minutes', label: 'Session notes', hint: 'Session notes to Drive and Aiva' },
  { id: 'attendance', label: 'Attendance sheet', hint: 'After each community session' },
  { id: 'next-meeting', label: 'Session planner', hint: 'When, who, theme, agenda' },
  { id: 'funder-month', label: 'Monthly funder report', hint: 'Month 1 evidence pack (no charts)' },
];

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  policies: 'Policies',
  minutes: 'Minutes',
  attendance: 'Attendance',
  'next-meeting': 'Next meeting',
  'funder-month': 'Activity reports',
  templates: 'Templates',
  inbox: 'Inbox',
};

const COMMUNITY_CATEGORY_LABELS: Record<string, string> = {
  policies: 'Policies and safeguarding',
  minutes: 'Session notes',
  attendance: 'Attendance',
  'next-meeting': 'Session planner',
  'funder-month': 'Funder reports',
  templates: 'Posters and templates',
  inbox: 'Inbox',
};

function resolvePackProfile(value: unknown): OpsPackProfile {
  return value === 'community-sessions' ? 'community-sessions' : 'default';
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function linesToList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function bulletsFromNotes(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isDriveConnected(grants: Array<{ toolSlug: string; status: string }>): boolean {
  return grants.some((g) => g.toolSlug === 'google-drive' && g.status === 'connected');
}

function planBlockedMessage(body: OpsStatus & { error?: string; message?: string }): string | null {
  if (body.requiredPlan) {
    return `Google Drive ops needs the ${body.requiredPlan} plan. Upgrade billing to continue.`;
  }
  const err = body.error ?? body.message ?? '';
  if (/plan|upgrade|business/i.test(err) && /required|upgrade|plan/i.test(err)) {
    return err;
  }
  return null;
}

export function WorkspaceOpsTab({
  workerId,
  workerName,
  section,
  initialCapture,
  onRequestSection,
  oauthReturnPath,
  showFullWorkspaceLink = false,
}: {
  workerId: string;
  workerName?: string;
  section: OpsSection;
  initialCapture?: string | null;
  onRequestSection: (section: OpsSection) => void;
  oauthReturnPath?: string;
  showFullWorkspaceLink?: boolean;
}) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<OpsStatus | null>(null);
  const [documents, setDocuments] = useState<OpsDocument[]>([]);
  const [driveConnected, setDriveConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [orgName, setOrgName] = useState('');
  const [packProfile, setPackProfile] = useState<OpsPackProfile>('default');
  const [captureKind, setCaptureKind] = useState<CaptureKind>(
    initialCapture && DEFAULT_CAPTURE_OPTIONS.some((o) => o.id === initialCapture)
      ? (initialCapture as CaptureKind)
      : 'minutes',
  );
  const [originFilter, setOriginFilter] = useState<OriginFilter>('aiva');

  const [minutesDate, setMinutesDate] = useState(todayIsoDate);
  const [minutesTitle, setMinutesTitle] = useState('');
  const [minutesNotes, setMinutesNotes] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate);
  const [sessionTitle, setSessionTitle] = useState('');
  const [venueOrSessionType, setVenueOrSessionType] = useState('');
  const [present, setPresent] = useState('');
  const [apologies, setApologies] = useState('');
  const [nextWhen, setNextWhen] = useState('');
  const [nextInvitees, setNextInvitees] = useState('');
  const [nextAgenda, setNextAgenda] = useState('');
  const [funderMonth, setFunderMonth] = useState(currentMonth);
  const [funderCount, setFunderCount] = useState('');
  const [sessionsHeldCount, setSessionsHeldCount] = useState('');
  const [funderBullets, setFunderBullets] = useState('');
  const [postersComms, setPostersComms] = useState('');
  const [outcomesQuotes, setOutcomesQuotes] = useState('');

  const returnPath =
    oauthReturnPath ||
    `/documents?tab=drive&section=setup&workerId=${encodeURIComponent(workerId)}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ workerId });
      const [statusRes, docsRes, toolsRes] = await Promise.all([
        fetch(`/api/aiva/workspace-ops/status?${qs}`),
        fetch(`/api/aiva/workspace-ops/documents?${qs}`),
        fetch(`/api/aiva/workers/${workerId}/tools`),
      ]);

      const statusBody = (await statusRes.json()) as OpsStatus;
      if (!statusRes.ok) {
        const planMsg = planBlockedMessage(statusBody);
        setStatus(statusBody);
        setError(planMsg ?? statusBody.error ?? 'Could not load Drive status');
      } else {
        setStatus(statusBody);
        if (statusBody.binding?.orgName) setOrgName(statusBody.binding.orgName);
        setPackProfile(
          resolvePackProfile(
            statusBody.packProfile
              ?? statusBody.binding?.meta?.packProfile,
          ),
        );
      }

      if (docsRes.ok) {
        const docsBody = (await docsRes.json()) as { documents?: OpsDocument[] };
        setDocuments(docsBody.documents ?? []);
      }

      if (toolsRes.ok) {
        const toolsBody = (await toolsRes.json()) as {
          grants?: Array<{ toolSlug: string; status: string }>;
          accountGrants?: Array<{ toolSlug: string; status: string }>;
        };
        const grants = [...(toolsBody.grants ?? []), ...(toolsBody.accountGrants ?? [])];
        setDriveConnected(isDriveConnected(grants));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Drive ops');
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialCapture && DEFAULT_CAPTURE_OPTIONS.some((o) => o.id === initialCapture)) {
      setCaptureKind(initialCapture as CaptureKind);
    }
  }, [initialCapture]);

  useEffect(() => {
    const ok = searchParams.get('tools_oauth_ok');
    const fail = searchParams.get('tools_oauth_error');
    if (ok) {
      setNotice('Google Drive connected. You can create the Ops folder pack next.');
      setError('');
      void load();
    } else if (fail) {
      let message = fail;
      try {
        message = decodeURIComponent(fail);
        const parsed = JSON.parse(message) as { error?: { message?: string } };
        if (parsed?.error?.message) message = parsed.error.message;
      } catch {
        try {
          message = decodeURIComponent(fail);
        } catch {
          message = fail;
        }
      }
      setError(`Google connect failed: ${message}`);
      void load();
    }
  }, [searchParams, load]);

  const bootstrapped = Boolean(status?.bootstrapped && status.binding?.rootFolderId);
  const folders = status?.folders ?? [];
  const lastRun = status?.lastRun ?? null;
  const isCommunityPack = packProfile === 'community-sessions';
  const captureOptions = isCommunityPack ? COMMUNITY_CAPTURE_OPTIONS : DEFAULT_CAPTURE_OPTIONS;
  const categoryLabels = isCommunityPack ? COMMUNITY_CATEGORY_LABELS : DEFAULT_CATEGORY_LABELS;

  const docsByCategory = useMemo(() => {
    const map = new Map<string, OpsDocument[]>();
    for (const doc of documents) {
      const origin = classifyDocumentOrigin(doc);
      if (!matchesOriginFilter({ origin }, originFilter)) continue;
      const key = doc.category || 'inbox';
      const list = map.get(key) ?? [];
      list.push(doc);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [documents, originFilter]);

  async function connectGoogleDrive() {
    setBusy('oauth');
    setError('');
    setNotice('');
    try {
      const qs = new URLSearchParams({
        workerId,
        toolSlug: 'google-drive',
        returnPath,
        redirectUri: `${window.location.origin}/api/aiva/tools/oauth/google/callback`,
      });
      const res = await fetch(`/api/aiva/tools/oauth/google/auth-url?${qs}`);
      const data = (await res.json()) as { authUrl?: string; error?: string };
      if (!res.ok || !data.authUrl) {
        throw new Error(data.error ?? 'Could not start Google OAuth');
      }
      window.location.href = data.authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect Google Drive');
      setBusy('');
    }
  }

  async function runBootstrap() {
    setBusy('bootstrap');
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/aiva/workspace-ops/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId,
          orgName: orgName.trim(),
          seedTemplates: true,
          packProfile,
        }),
      });
      const data = (await res.json()) as OpsStatus & {
        error?: string;
        rootFolderName?: string;
      };
      if (!res.ok) {
        throw new Error(planBlockedMessage(data) ?? data.error ?? 'Bootstrap failed');
      }
      setNotice(`Created ${data.rootFolderName ?? 'Ops'} folder pack in Google Drive.`);
      await load();
      onRequestSection('home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bootstrap failed');
    } finally {
      setBusy('');
    }
  }

  async function runSync() {
    setBusy('sync');
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/aiva/workspace-ops/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, direction: 'both' }),
      });
      const data = (await res.json()) as OpsSyncRun & { error?: string; ok?: boolean };
      if (!res.ok) {
        throw new Error(planBlockedMessage(data as OpsStatus) ?? data.error ?? 'Sync failed');
      }
      setNotice(
        `Sync finished. Pulled ${data.pulled ?? 0}, pushed ${data.pushed ?? 0}, conflicts ${data.conflicts ?? 0}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setBusy('');
    }
  }

  async function submitCapture() {
    setBusy('capture');
    setError('');
    setNotice('');
    try {
      let path = '';
      let body: Record<string, unknown> = { workerId };

      if (captureKind === 'minutes') {
        path = '/api/aiva/workspace-ops/minutes';
        body = {
          workerId,
          date: minutesDate,
          title: minutesTitle.trim(),
          bullets: bulletsFromNotes(minutesNotes),
        };
      } else if (captureKind === 'attendance') {
        path = '/api/aiva/workspace-ops/attendance';
        body = {
          workerId,
          meetingDate: attendanceDate,
          sessionTitle: sessionTitle.trim(),
          venueOrSessionType: venueOrSessionType.trim(),
          present: linesToList(present),
          apologies: linesToList(apologies),
        };
      } else if (captureKind === 'next-meeting') {
        path = '/api/aiva/workspace-ops/next-meeting';
        body = {
          workerId,
          when: nextWhen.trim(),
          invitees: linesToList(nextInvitees),
          agenda: bulletsFromNotes(nextAgenda),
        };
      } else {
        path = '/api/aiva/workspace-ops/funder-month';
        body = {
          workerId,
          month: funderMonth.trim(),
          count: funderCount.trim() ? Number(funderCount) : null,
          sessionsHeldCount: sessionsHeldCount.trim() ? Number(sessionsHeldCount) : null,
          bullets: bulletsFromNotes(funderBullets),
          postersComms: bulletsFromNotes(postersComms),
          outcomesQuotes: bulletsFromNotes(outcomesQuotes),
        };
      }

      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; document?: { title?: string } };
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not save to Drive');
      }
      setNotice(`Saved ${data.document?.title ?? 'document'} to Drive and Aiva.`);
      await load();
      onRequestSection('files');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {workerName || workerId}
          </p>
          <h2 className="mt-1 text-lg font-semibold capitalize text-text-primary">
            {section === 'capture' ? 'Record' : section}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Google Drive workspace operations are scoped to this AI Employee.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bootstrapped ? (
            <button
              type="button"
              onClick={() => void runSync()}
              disabled={Boolean(busy)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium text-text-primary hover:bg-muted disabled:opacity-50"
            >
              {busy === 'sync' ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
              Sync now
            </button>
          ) : null}
          {section !== 'setup' ? (
            <button
              type="button"
              onClick={() => onRequestSection('setup')}
              className="inline-flex min-h-10 items-center text-sm font-medium text-accent hover:underline"
            >
              Open Drive setup
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-text-primary">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>{notice}</p>
        </div>
      ) : null}

      {section === 'home' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Status</p>
              <p className="mt-2 text-sm text-text-primary">
                {!driveConnected
                  ? 'Google Drive is not connected yet.'
                  : !bootstrapped
                    ? 'Drive connected. Create the Ops folder pack to finish setup.'
                    : `${status?.binding?.orgName ?? 'Ops'} is ready.`}
              </p>
              {status?.binding?.lastSyncAt ? (
                <p className="mt-2 text-xs text-text-muted">
                  Last sync {formatTimestamp(status.binding.lastSyncAt)}
                </p>
              ) : null}
              {lastRun?.error ? (
                <p className="mt-2 text-xs text-danger">{lastRun.error}</p>
              ) : null}
              {status?.binding?.lastError ? (
                <p className="mt-2 text-xs text-danger">{status.binding.lastError}</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Library</p>
              <p className="mt-2 text-2xl font-semibold text-text-primary">{documents.length}</p>
              <p className="text-xs text-text-muted">
                synced documents · {status?.mappingCount ?? 0} Drive mappings
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!driveConnected || !bootstrapped ? (
              <button
                type="button"
                onClick={() => onRequestSection('setup')}
                className="inline-flex min-h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-primary-foreground"
              >
                Finish Drive setup
              </button>
            ) : (
              <>
                <div className="w-full rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-sm text-text-secondary">
                  After each session: Record attendance. End of month: Record monthly funder report.
                  Charts come later if needed.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureKind('attendance');
                    onRequestSection('capture');
                  }}
                  className="inline-flex min-h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-primary-foreground"
                >
                  Record attendance
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureKind('funder-month');
                    onRequestSection('capture');
                  }}
                  className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-text-primary hover:bg-muted"
                >
                  Record monthly funder report
                </button>
                <button
                  type="button"
                  onClick={() => onRequestSection('files')}
                  className="inline-flex min-h-10 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-text-primary hover:bg-muted"
                >
                  Browse files
                </button>
              </>
            )}
          </div>

          {folders.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                Drive folders
              </p>
              <ul className="mt-3 space-y-1.5">
                {folders.map((folder) => (
                  <li key={folder.folderId} className="flex items-center gap-2 text-sm text-text-secondary">
                    <FolderSync className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <span>{folder.folderName}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {section === 'setup' ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">1. Connect Google Drive</h3>
            <p className="mt-1 text-sm text-text-muted">
              Authorize Drive for this AI Employee so Aiva can create and sync documents.
            </p>
            <button
              type="button"
              onClick={() => void connectGoogleDrive()}
              disabled={Boolean(busy)}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === 'oauth' ? <Spinner size="sm" /> : <Link2 className="h-4 w-4" />}
              {driveConnected ? 'Reconnect Google Drive' : 'Connect with Google'}
            </button>
            {driveConnected ? (
              <p className="mt-2 text-xs text-accent">Google Drive is connected for this employee.</p>
            ) : null}
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text-primary">2. Create Ops folder pack</h3>
            <p className="mt-1 text-sm text-text-muted">
              {isCommunityPack
                ? 'Creates top-level Aiva folders in Drive (Policies and Safeguarding, Session Notes, Attendance, Session Planner, Funder Reports, Posters and Templates, Inbox). Month subfolders such as 2026-06 live under Attendance, Session Notes, and Posters. Keep finance spreadsheets under Funder-Reports or a Drive subfolder named Finance.'
                : 'Creates a numbered Drive tree (Policies, Minutes, Attendance, Next meeting, reports, Templates, Inbox) and binds it to Aiva.'}
            </p>
            <label className="mt-3 block text-xs font-medium text-text-muted" htmlFor="ops-pack-profile">
              Folder pack style
            </label>
            <select
              id="ops-pack-profile"
              className={cn(AIVA_INPUT_CLASS, 'mt-1 max-w-md')}
              value={packProfile}
              onChange={(e) => setPackProfile(resolvePackProfile(e.target.value))}
            >
              <option value="default">Default (committees / general ops)</option>
              <option value="community-sessions">Community sessions (wellbeing / monthly sessions)</option>
            </select>
            <label className="mt-3 block text-xs font-medium text-text-muted" htmlFor="ops-org-name">
              Organisation name
            </label>
            <input
              id="ops-org-name"
              className={cn(AIVA_INPUT_CLASS, 'mt-1 max-w-md')}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={isCommunityPack ? 'e.g. Sister Luba sessions' : 'e.g. Oak Community Trust'}
            />
            <button
              type="button"
              onClick={() => void runBootstrap()}
              disabled={!driveConnected || !orgName.trim() || Boolean(busy)}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-elevated px-4 text-sm font-medium text-text-primary hover:bg-muted disabled:opacity-50"
            >
              {busy === 'bootstrap' ? <Spinner size="sm" /> : <FolderSync className="h-4 w-4" />}
              {bootstrapped ? 'Refresh folder pack' : 'Create folder pack'}
            </button>
            {bootstrapped && status?.binding?.rootFolderName ? (
              <p className="mt-2 text-xs text-text-muted">
                Bound to {status.binding.rootFolderName}
                {status.binding.rootFolderId ? ` (${status.binding.rootFolderId})` : ''}
                {isCommunityPack ? ' · community sessions pack' : ''}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {section === 'files' ? (
        <section className="space-y-4">
          <div className="space-y-1.5">
            <OriginFilterChips value={originFilter} onChange={setOriginFilter} />
            <p className="text-[11px] text-text-muted">{DOCUMENTS_ORIGIN_HELPER_TEXT}</p>
          </div>
          {!bootstrapped ? (
            <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center">
              <p className="text-sm font-medium text-text-primary">No Drive library yet</p>
              <p className="mt-1 text-sm text-text-muted">Finish setup to sync and browse documents.</p>
              <button
                type="button"
                onClick={() => onRequestSection('setup')}
                className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-accent hover:underline"
              >
                Open Drive setup
              </button>
            </div>
          ) : docsByCategory.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center">
              <p className="text-sm font-medium text-text-primary">No synced files yet</p>
              <p className="mt-1 text-sm text-text-muted">
                Record minutes or run Sync now to pull Drive docs into Aiva. Default view is Ops / Aiva.
              </p>
            </div>
          ) : (
            docsByCategory.map(([category, docs]) => (
              <div key={category} className="rounded-2xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {categoryLabels[category] ?? category}
                </h3>
                <ul className="mt-3 divide-y divide-border">
                  {docs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-text-primary">{doc.title}</p>
                          <OriginBadge origin={classifyDocumentOrigin(doc)} />
                        </div>
                        <p className="text-xs text-text-muted">
                          {doc.syncStatus ?? 'pending'}
                          {doc.createdAt ? ` · ${formatTimestamp(doc.createdAt)}` : ''}
                        </p>
                      </div>
                      {doc.driveWebViewLink ? (
                        <a
                          href={doc.driveWebViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                        >
                          Open in Drive
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      ) : null}

      {section === 'capture' ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          {!bootstrapped ? (
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">Setup required</p>
              <p className="mt-1 text-sm text-text-muted">
                Bootstrap the Ops folder pack before recording to Drive.
              </p>
              <button
                type="button"
                onClick={() => onRequestSection('setup')}
                className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-accent hover:underline"
              >
                Open Drive setup
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-muted">
                Month 1: save attendance after each session; at month end save one funder report.
                Charts come later if needed.
              </p>
              <div className="flex flex-wrap gap-2">
                {captureOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCaptureKind(opt.id)}
                    className={cn(
                      'rounded-xl px-3 py-2 text-left text-sm transition',
                      captureKind === opt.id
                        ? 'bg-accent/15 text-accent ring-1 ring-accent/30'
                        : 'bg-muted/60 text-text-secondary hover:bg-muted',
                    )}
                  >
                    <span className="block font-medium">{opt.label}</span>
                    <span className="mt-0.5 block text-[11px] text-text-muted">{opt.hint}</span>
                  </button>
                ))}
              </div>

              {captureKind === 'minutes' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="minutes-date">
                      Date
                    </label>
                    <input
                      id="minutes-date"
                      type="date"
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={minutesDate}
                      onChange={(e) => setMinutesDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="minutes-title">
                      Title
                    </label>
                    <input
                      id="minutes-title"
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={minutesTitle}
                      onChange={(e) => setMinutesTitle(e.target.value)}
                      placeholder="Committee meeting"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-text-muted" htmlFor="minutes-notes">
                      Notes (one bullet per line)
                    </label>
                    <textarea
                      id="minutes-notes"
                      rows={6}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={minutesNotes}
                      onChange={(e) => setMinutesNotes(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {captureKind === 'attendance' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="attendance-date">
                      Session / meeting date
                    </label>
                    <input
                      id="attendance-date"
                      type="date"
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="session-title">
                      Session name or title
                    </label>
                    <input
                      id="session-title"
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                      placeholder="e.g. Tuesday coffee morning"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-text-muted" htmlFor="venue-type">
                      Venue / session type (optional)
                    </label>
                    <input
                      id="venue-type"
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={venueOrSessionType}
                      onChange={(e) => setVenueOrSessionType(e.target.value)}
                      placeholder="e.g. community hall, wellbeing group"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="present">
                      Present (verified names only)
                    </label>
                    <textarea
                      id="present"
                      rows={4}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={present}
                      onChange={(e) => setPresent(e.target.value)}
                      placeholder="One name per line, or comma separated"
                    />
                    <p className="mt-1 text-[11px] text-text-muted">
                      Aiva must not invent attendees. Only list people who were there.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="apologies">
                      Apologies
                    </label>
                    <textarea
                      id="apologies"
                      rows={4}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={apologies}
                      onChange={(e) => setApologies(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {captureKind === 'next-meeting' ? (
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="next-when">
                      When
                    </label>
                    <input
                      id="next-when"
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={nextWhen}
                      onChange={(e) => setNextWhen(e.target.value)}
                      placeholder="2026-07-24 18:00 or Thursday 6pm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="next-invitees">
                      Invitees
                    </label>
                    <textarea
                      id="next-invitees"
                      rows={3}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={nextInvitees}
                      onChange={(e) => setNextInvitees(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="next-agenda">
                      Agenda (one item per line)
                    </label>
                    <textarea
                      id="next-agenda"
                      rows={4}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={nextAgenda}
                      onChange={(e) => setNextAgenda(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {captureKind === 'funder-month' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="funder-month">
                      Month (YYYY-MM)
                    </label>
                    <input
                      id="funder-month"
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={funderMonth}
                      onChange={(e) => setFunderMonth(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="sessions-held">
                      Sessions held (verified count only, optional)
                    </label>
                    <input
                      id="sessions-held"
                      type="number"
                      min={0}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={sessionsHeldCount}
                      onChange={(e) => setSessionsHeldCount(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-text-muted" htmlFor="funder-count">
                      People supported (verified count only, optional)
                    </label>
                    <input
                      id="funder-count"
                      type="number"
                      min={0}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1 max-w-xs')}
                      value={funderCount}
                      onChange={(e) => setFunderCount(e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-text-muted">
                      Never invent counts. Leave blank if not verified.
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-text-muted" htmlFor="funder-bullets">
                      Activity bullets
                    </label>
                    <textarea
                      id="funder-bullets"
                      rows={4}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={funderBullets}
                      onChange={(e) => setFunderBullets(e.target.value)}
                      placeholder="One activity per line"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="posters-comms">
                      Posters / communications done (optional)
                    </label>
                    <textarea
                      id="posters-comms"
                      rows={3}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={postersComms}
                      onChange={(e) => setPostersComms(e.target.value)}
                      placeholder="Human-entered only"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-text-muted" htmlFor="outcomes-quotes">
                      Outcomes / quotes (optional)
                    </label>
                    <textarea
                      id="outcomes-quotes"
                      rows={3}
                      className={cn(AIVA_INPUT_CLASS, 'mt-1')}
                      value={outcomesQuotes}
                      onChange={(e) => setOutcomesQuotes(e.target.value)}
                      placeholder="Human-entered only"
                    />
                  </div>
                  <p className="sm:col-span-2 text-[11px] text-text-muted">
                    Saves as Draft status: draft. Human approval required before send to funders.
                    Month 1 is structured Drive documents; charts come later if needed.
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void submitCapture()}
                disabled={Boolean(busy)}
                className="inline-flex min-h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy === 'capture' ? <Spinner size="sm" /> : null}
                {busy === 'capture' ? 'Saving...' : 'Save to Drive and Aiva'}
              </button>
            </>
          )}
        </section>
      ) : null}

      {showFullWorkspaceLink ? (
        <Link
          href={`/documents?tab=drive&workerId=${encodeURIComponent(workerId)}`}
          className="inline-flex text-sm font-medium text-accent hover:underline"
        >
          Open the full Documents and Drive workspace
        </Link>
      ) : null}
    </div>
  );
}

export default WorkspaceOpsTab;
