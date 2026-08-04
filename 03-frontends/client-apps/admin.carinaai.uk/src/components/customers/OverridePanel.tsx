'use client';

import { useEffect, useState, type ReactNode } from 'react';
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

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

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
  const [dangerOpen, setDangerOpen] = useState(false);

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
    <aside className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col self-start lg:h-full lg:max-h-none lg:self-stretch lg:overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-elevated">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Admin overrides
          </p>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Change access or top up. Full AI usage is on the Billing tab.
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border">
          <div className="bg-elevated px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-text-muted">AI budget</p>
            <p className="mt-0.5 text-sm font-semibold text-text-primary">
              {walletRemainingGbp === null ? '...' : `£${walletRemainingGbp.toFixed(2)}`}
            </p>
            <p className="text-[10px] text-text-muted">Managed wallet left</p>
          </div>
          <div className="bg-elevated px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Trial ends</p>
            <p className="mt-0.5 text-sm font-semibold text-text-primary">
              {trialEndsAt ? formatDate(trialEndsAt) : 'N/A'}
            </p>
            <p className="text-[10px] text-text-muted capitalize">{subscription.planTier}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <Section title="Plan & access" hint="Trial length, plan tier, and Aiva kill switch.">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={90}
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
                className="admin-input w-16 px-2 py-1.5 text-xs"
                aria-label="Days to extend trial"
              />
              <span className="text-xs text-text-muted">days</span>
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
                Extend trial
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <select
                value={forcePlan}
                onChange={(e) => setForcePlan(e.target.value)}
                className="admin-input text-xs"
                aria-label="Force plan tier"
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
                placeholder="Reason for plan change (required)"
                className="admin-input text-xs"
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
                Force plan
              </button>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
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
                className="btn-admin-danger w-full"
              >
                Pause Aivas ({activeAivaCount})
              </button>
              {pausedAivaCount > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      `Resume ${pausedAivaCount} paused Aivas for ${workspaceName}?`,
                      () =>
                        fetch(`/api/admin/workspaces/${workspaceId}/resume`, { method: 'POST' }),
                      () => 'Done.',
                    )
                  }
                  className="btn-admin-credit w-full"
                >
                  Resume Aivas ({pausedAivaCount})
                </button>
              ) : null}
            </div>
          </Section>

          <div className="border-t border-border" />

          <Section
            title="AI usage credit"
            hint={`Adds GBP to the managed AI wallet (usage budget). Current balance: £${
              walletRemainingGbp === null ? ';' : walletRemainingGbp.toFixed(2)
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">£</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={walletAmountGbp}
                onChange={(e) => setWalletAmountGbp(e.target.value)}
                className="admin-input w-24 text-xs"
                placeholder="1"
                aria-label="AI credit amount in GBP"
              />
              <span className="text-xs text-text-muted">GBP</span>
            </div>
            <input
              value={walletNote}
              onChange={(e) => setWalletNote(e.target.value)}
              placeholder="Note (optional)"
              className="admin-input text-xs"
            />
            {poundsToPence(walletAmountGbp) < 1 ? (
              <p className="text-[11px] text-text-muted">Enter an amount of at least £0.01.</p>
            ) : null}
            <button
              type="button"
              disabled={busy || poundsToPence(walletAmountGbp) < 1}
              onClick={() => {
                const amountPence = poundsToPence(walletAmountGbp);
                if (amountPence < 1) {
                  showError('Enter a valid amount (at least £0.01).');
                  return;
                }
                const note = walletNote.trim() || 'Admin AI usage credit';
                void runAction(
                  `Add £${(amountPence / 100).toFixed(2)} AI usage credit to ${workspaceName}?`,
                  () =>
                    fetch(`/api/admin/workspaces/${workspaceId}/ai-wallet/credit`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        amountPence,
                        note,
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
              className="btn-admin-credit w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply AI usage credit
            </button>
          </Section>

          <div className="border-t border-border" />

          <Section
            title="Stripe invoice credit"
            hint="Customer balance on invoices only. Does not fund AI model usage."
          >
            <div className="flex gap-2">
              <span className="self-center text-xs text-text-muted">£</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={stripeCreditGbp}
                onChange={(e) => setStripeCreditGbp(e.target.value)}
                className="admin-input w-24 text-xs"
                placeholder="50"
                aria-label="Stripe credit amount in GBP"
              />
            </div>
            <input
              value={stripeCreditNote}
              onChange={(e) => setStripeCreditNote(e.target.value)}
              placeholder="Note (optional)"
              className="admin-input text-xs"
            />
            <button
              type="button"
              disabled={busy || poundsToPence(stripeCreditGbp) < 1}
              onClick={() => {
                const amount = poundsToPence(stripeCreditGbp);
                if (amount < 1) {
                  showError('Enter a valid amount (at least £0.01).');
                  return;
                }
                const note = stripeCreditNote.trim() || 'Admin Stripe credit';
                void runAction(
                  `Add £${(amount / 100).toFixed(2)} Stripe billing credit to ${workspaceName}?`,
                  () =>
                    fetch(`/api/admin/workspaces/${workspaceId}/credit`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        amount,
                        note,
                      }),
                    }),
                  (body) => {
                    setStripeCreditGbp('');
                    setStripeCreditNote('');
                    return `Done. Credit note ${String(body.creditNoteId ?? '').slice(0, 16)}.`;
                  },
                );
              }}
              className="btn-admin-credit w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add Stripe credit
            </button>
          </Section>

          <div className="border-t border-border" />

          <Section title="Internal notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="admin-input resize-none text-xs"
              placeholder="Notes about this workspace"
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
                  showOk('Notes saved.');
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
          </Section>

          {feedback ? (
            <p
              className={[
                'text-xs transition-opacity',
                feedback.type === 'error' ? 'text-danger' : 'text-green-400',
              ].join(' ')}
            >
              {feedback.message}
            </p>
          ) : null}

          <div className="rounded-lg border border-red-500/25 bg-base/30">
            <button
              type="button"
              onClick={() => setDangerOpen((open) => !open)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              aria-expanded={dangerOpen}
            >
              <div>
                <p className="text-xs font-semibold text-red-400">Danger zone</p>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  GDPR erasure and permanent purge
                </p>
              </div>
              <span className="text-[11px] text-text-muted">{dangerOpen ? 'Hide' : 'Show'}</span>
            </button>

            {dangerOpen ? (
              <div className="space-y-4 border-t border-red-500/20 p-3">
                <Section
                  title="GDPR erasure"
                  hint="Cancels Stripe, clears conversation PII, dismisses Aivas, hard delete in 30 days. Attestation hashes stay on the ledger."
                >
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
                </Section>

                <Section
                  title="Immediate purge"
                  hint={`Permanently removes this workspace, Aivas, billing rows, and cloud login. For test signups.${
                    isLikelyTest ? ' This looks like a test account.' : ''
                  }`}
                >
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
                        placeholder="Type PURGE to confirm"
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
                          Active paid billing. I reviewed and want to force purge.
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
                </Section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
