'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/format';

interface SubscriptionInfo {
  planTier: string;
  status: string;
  trialEndsAt: string | null;
  aivasUsed: number;
  slotLimit: number;
  monthlyAmountPence?: number;
}

interface OverridePanelProps {
  workspaceId: string;
  workspaceName: string;
  ownerEmail?: string | null;
  subscription: SubscriptionInfo;
  adminNotes: string;
  activeAivaCount: number;
  pausedAivaCount: number;
  onUpdated: () => void;
}

type Feedback = { type: 'ok' | 'error'; message: string };

export function OverridePanel({
  workspaceId,
  workspaceName,
  ownerEmail,
  subscription,
  adminNotes,
  activeAivaCount,
  pausedAivaCount,
  onUpdated,
}: OverridePanelProps) {
  const { push: toast } = useToast();
  const [extendDays, setExtendDays] = useState('14');
  const [forcePlan, setForcePlan] = useState(subscription.planTier);
  const [forceReason, setForceReason] = useState('');
  const [walletAmountGbp, setWalletAmountGbp] = useState('');
  const [walletNote, setWalletNote] = useState('');
  const [walletRemainingGbp, setWalletRemainingGbp] = useState<number | null>(null);
  const [stripeCreditGbp, setStripeCreditGbp] = useState('');
  const [stripeCreditNote, setStripeCreditNote] = useState('');
  const [notes, setNotes] = useState(adminNotes);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [trialEndsAt, setTrialEndsAt] = useState(subscription.trialEndsAt);
  const [eraseConfirm, setEraseConfirm] = useState('');
  const [showErase, setShowErase] = useState(false);
  const [purgeIdConfirm, setPurgeIdConfirm] = useState('');
  const [purgeAck, setPurgeAck] = useState('');
  const [purgeForce, setPurgeForce] = useState(false);
  const [showPurge, setShowPurge] = useState(false);

  useEffect(() => {
    setNotes(adminNotes);
  }, [adminNotes]);

  useEffect(() => {
    setTrialEndsAt(subscription.trialEndsAt);
  }, [subscription.trialEndsAt]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/workspaces/${workspaceId}/ai-wallet`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          balance?: { remainingGbp?: number; remainingPence?: number };
        };
        if (cancelled) return;
        const gbp =
          typeof body.balance?.remainingGbp === 'number'
            ? body.balance.remainingGbp
            : typeof body.balance?.remainingPence === 'number'
              ? body.balance.remainingPence / 100
              : null;
        setWalletRemainingGbp(gbp);
      } catch {
        // Balance is informational; credit actions still work without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function showOk(message: string) {
    setFeedback({ type: 'ok', message });
    window.setTimeout(() => setFeedback(null), 3000);
  }

  function showError(message: string) {
    setFeedback({ type: 'error', message });
  }

  async function runAction(
    label: string,
    request: () => Promise<Response>,
    onSuccess: (body: Record<string, unknown>) => string,
  ) {
    if (!window.confirm(label)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await request();
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Action failed (${res.status})`);
      showOk(onSuccess(body));
      onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      showError(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function poundsToPence(raw: string): number {
    const pounds = Number(raw);
    if (!Number.isFinite(pounds) || pounds <= 0) return 0;
    return Math.round(pounds * 100);
  }

  const isLikelyTest =
    !ownerEmail?.trim() ||
    ownerEmail.endsWith('@example.com') ||
    /(test|debug|signup|terms-test|example\.)/i.test(ownerEmail);

  const isActivePaid =
    subscription.status === 'active' && Number(subscription.monthlyAmountPence ?? 0) > 0;

  return (
    <div className="sticky top-6 rounded-lg border border-amber-500/20 bg-elevated p-4">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
        Admin overrides
      </p>

      <div>
        <p className="mb-2 text-xs font-medium text-text-primary">Trial extension</p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={90}
            value={extendDays}
            onChange={(e) => setExtendDays(e.target.value)}
            className="admin-input w-16 px-2 py-1.5 text-xs"
            placeholder="14"
          />
          <span className="self-center text-xs text-text-muted">days</span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runAction(
                `Extend trial for ${workspaceName} by ${extendDays} days?`,
                () =>
                  fetch(`/api/admin/workspaces/${workspaceId}/trial`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ extendByDays: Number(extendDays) }),
                  }),
                (body) => {
                  if (typeof body.trialEndsAt === 'string') setTrialEndsAt(body.trialEndsAt);
                  return `Done. Trial ends ${formatDate(String(body.trialEndsAt ?? trialEndsAt))}.`;
                },
              )
            }
            className="btn-admin-credit text-xs"
          >
            Extend
          </button>
        </div>
        <p className="mt-1 text-[11px] text-text-muted">
          Current: {trialEndsAt ? formatDate(trialEndsAt) : 'N/A'}
        </p>
      </div>

      <div className="admin-section-divider" />

      <div>
        <p className="mb-2 text-xs font-medium text-text-primary">Force plan</p>
        <select
          value={forcePlan}
          onChange={(e) => setForcePlan(e.target.value)}
          className="admin-input mb-2 text-xs"
        >
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="team">Team</option>
          <option value="business">Business</option>
          <option value="suspended">Suspended</option>
        </select>
        <input
          value={forceReason}
          onChange={(e) => setForceReason(e.target.value)}
          placeholder="Reason (required)"
          className="admin-input mb-2 text-xs"
        />
        <button
          type="button"
          disabled={busy || !forceReason.trim()}
          onClick={() =>
            void runAction(
              `Force plan to ${forcePlan} for ${workspaceName}? This affects billing access.`,
              () =>
                fetch(`/api/admin/workspaces/${workspaceId}/plan`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ planTier: forcePlan, reason: forceReason.trim() }),
                }),
              () => 'Done.',
            )
          }
          className="btn-admin-danger w-full"
        >
          Apply
        </button>
      </div>

      <div className="admin-section-divider" />

      <div>
        <p className="mb-2 text-xs font-medium text-text-primary">Aivas</p>
        <button
          type="button"
          disabled={busy || activeAivaCount === 0}
          onClick={() =>
            void runAction(
              `Pause all ${activeAivaCount} active Aivas for ${workspaceName}?`,
              () => fetch(`/api/admin/workspaces/${workspaceId}/pause`, { method: 'POST' }),
              () => 'Done.',
            )
          }
          className="btn-admin-danger mb-1 w-full"
        >
          Pause all ({activeAivaCount})
        </button>
        {pausedAivaCount > 0 ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void runAction(
                `Resume ${pausedAivaCount} paused Aivas for ${workspaceName}?`,
                () => fetch(`/api/admin/workspaces/${workspaceId}/resume`, { method: 'POST' }),
                () => 'Done.',
              )
            }
            className="btn-admin-credit w-full"
          >
            Resume ({pausedAivaCount} paused)
          </button>
        ) : null}
      </div>

      <div className="admin-section-divider" />

      <div>
        <p className="mb-2 text-xs font-medium text-text-primary">AI usage credit</p>
        <p className="mb-2 text-[11px] text-text-muted">
          Adds GBP to the managed AI wallet (usage budget). Current balance:{' '}
          {walletRemainingGbp === null ? '...' : `£${walletRemainingGbp.toFixed(2)}`}
        </p>
        <div className="mb-2 flex gap-2">
          <span className="self-center text-xs text-text-muted">£</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={walletAmountGbp}
            onChange={(e) => setWalletAmountGbp(e.target.value)}
            className="admin-input w-24 text-xs"
            placeholder="50"
          />
          <span className="self-center text-[11px] text-text-muted">GBP</span>
        </div>
        <input
          value={walletNote}
          onChange={(e) => setWalletNote(e.target.value)}
          placeholder="Note (required)"
          className="admin-input mb-2 text-xs"
        />
        <button
          type="button"
          disabled={busy || poundsToPence(walletAmountGbp) < 1 || !walletNote.trim()}
          onClick={() => {
            const amountPence = poundsToPence(walletAmountGbp);
            void runAction(
              `Add £${(amountPence / 100).toFixed(2)} AI usage credit to ${workspaceName}?`,
              () =>
                fetch(`/api/admin/workspaces/${workspaceId}/ai-wallet/credit`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    amountPence,
                    note: walletNote.trim(),
                  }),
                }),
              (body) => {
                const balance = body.balance as
                  | { remainingGbp?: number; remainingPence?: number }
                  | undefined;
                const gbp =
                  typeof balance?.remainingGbp === 'number'
                    ? balance.remainingGbp
                    : typeof balance?.remainingPence === 'number'
                      ? balance.remainingPence / 100
                      : null;
                if (gbp !== null) setWalletRemainingGbp(gbp);
                setWalletAmountGbp('');
                setWalletNote('');
                return gbp === null
                  ? 'Done. AI usage credit applied.'
                  : `Done. Wallet balance £${gbp.toFixed(2)}.`;
              },
            );
          }}
          className="btn-admin-credit w-full"
        >
          Apply AI usage credit
        </button>
      </div>

      <div className="admin-section-divider" />

      <div>
        <p className="mb-2 text-xs font-medium text-text-primary">Stripe billing credit</p>
        <p className="mb-2 text-[11px] text-text-muted">
          Applies a Stripe customer balance credit. Requires an existing Stripe customer on this
          workspace.
        </p>
        <div className="mb-2 flex gap-2">
          <span className="self-center text-xs text-text-muted">£</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={stripeCreditGbp}
            onChange={(e) => setStripeCreditGbp(e.target.value)}
            className="admin-input w-24 text-xs"
            placeholder="50"
          />
          <span className="self-center text-[11px] text-text-muted">GBP</span>
        </div>
        <input
          value={stripeCreditNote}
          onChange={(e) => setStripeCreditNote(e.target.value)}
          placeholder="Note (required)"
          className="admin-input mb-2 text-xs"
        />
        <button
          type="button"
          disabled={busy || poundsToPence(stripeCreditGbp) < 1 || !stripeCreditNote.trim()}
          onClick={() => {
            const amount = poundsToPence(stripeCreditGbp);
            void runAction(
              `Add £${(amount / 100).toFixed(2)} Stripe billing credit to ${workspaceName}?`,
              () =>
                fetch(`/api/admin/workspaces/${workspaceId}/credit`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    amount,
                    note: stripeCreditNote.trim(),
                  }),
                }),
              (body) => {
                setStripeCreditGbp('');
                setStripeCreditNote('');
                return `Done. Credit note ${String(body.creditNoteId ?? '').slice(0, 16)}.`;
              },
            );
          }}
          className="btn-admin-credit w-full"
        >
          Apply Stripe credit
        </button>
      </div>

      <div className="admin-section-divider" />

      <div>
        <p className="mb-2 text-xs font-medium text-text-primary">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="admin-input mb-2 resize-none text-xs"
          placeholder="Internal notes about this workspace"
        />
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setFeedback(null);
            try {
              const res = await fetch(`/api/admin/workspaces/${workspaceId}/notes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
              });
              if (!res.ok) throw new Error('Could not save notes');
              showOk('Done.');
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Could not save notes';
              showError(message);
              toast(message, 'error');
            } finally {
              setBusy(false);
            }
          }}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Save notes
        </button>
      </div>

      <div className="admin-section-divider" />

      <div>
        <p className="mb-2 text-xs font-medium text-danger">Erasure request</p>
        <p className="mb-2 text-[11px] text-text-muted">
          GDPR erasure cancels Stripe, clears conversation PII, dismisses Aivas, and schedules hard
          delete in 30 days. Blockchain attestation hashes remain on the public ledger.
        </p>
        {!showErase ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowErase(true)}
            className="btn-admin-danger w-full"
          >
            Delete workspace data
          </button>
        ) : (
          <div className="space-y-2">
            <input
              value={eraseConfirm}
              onChange={(e) => setEraseConfirm(e.target.value)}
              placeholder={`Type "${workspaceName}" to confirm`}
              className="admin-input text-xs"
            />
            <button
              type="button"
              disabled={busy || eraseConfirm !== workspaceName}
              onClick={() =>
                void runAction(
                  `Permanently erase all data for ${workspaceName}? This cannot be undone.`,
                  () =>
                    fetch(`/api/admin/workspaces/${workspaceId}/erase`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ confirm: eraseConfirm }),
                    }),
                  () => {
                    setShowErase(false);
                    setEraseConfirm('');
                    return 'Workspace erasure started. PII cleared; hard delete in 30 days.';
                  },
                )
              }
              className="btn-admin-danger w-full"
            >
              Erase all data
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setShowErase(false);
                setEraseConfirm('');
              }}
              className="w-full text-xs text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="admin-section-divider" />

      <div>
        <p className="mb-2 text-xs font-medium text-danger">Immediate purge (admin)</p>
        <p className="mb-2 text-[11px] text-text-muted">
          Permanently removes this workspace from Customers, deletes Aivas, billing rows, and the
          cloud login so the owner cannot sign in again. Use for test signups.
          {isLikelyTest ? ' This workspace looks like a test account.' : null}
        </p>
        {!showPurge ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowPurge(true)}
            className="btn-admin-danger w-full"
          >
            Purge workspace now
          </button>
        ) : (
          <div className="space-y-2">
            <input
              value={purgeIdConfirm}
              onChange={(e) => setPurgeIdConfirm(e.target.value)}
              placeholder="Paste workspace ID"
              className="admin-input font-mono text-xs"
            />
            <input
              value={purgeAck}
              onChange={(e) => setPurgeAck(e.target.value.toUpperCase())}
              placeholder='Type PURGE to confirm'
              className="admin-input text-xs"
            />
            {isActivePaid && !isLikelyTest ? (
              <label className="flex items-start gap-2 text-[11px] text-amber-400">
                <input
                  type="checkbox"
                  checked={purgeForce}
                  onChange={(e) => setPurgeForce(e.target.checked)}
                  className="mt-0.5 rounded border-border"
                />
                This workspace has active paid billing. I have reviewed and want to force purge.
              </label>
            ) : null}
            <button
              type="button"
              disabled={
                busy ||
                purgeIdConfirm !== workspaceId ||
                purgeAck !== 'PURGE' ||
                (isActivePaid && !isLikelyTest && !purgeForce)
              }
              onClick={() =>
                void runAction(
                  `Permanently purge ${workspaceName}? This cannot be undone.`,
                  () =>
                    fetch(`/api/admin/workspaces/${workspaceId}/purge`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        confirmId: purgeIdConfirm,
                        acknowledge: purgeAck,
                        force: purgeForce,
                      }),
                    }),
                  () => {
                    window.location.href = '/customers';
                    return 'Workspace purged.';
                  },
                )
              }
              className="btn-admin-danger w-full"
            >
              Purge now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setShowPurge(false);
                setPurgeIdConfirm('');
                setPurgeAck('');
                setPurgeForce(false);
              }}
              className="w-full text-xs text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {feedback ? (
        <p
          className={[
            'mt-3 text-xs transition-opacity',
            feedback.type === 'error' ? 'text-danger' : 'text-green-400',
          ].join(' ')}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
