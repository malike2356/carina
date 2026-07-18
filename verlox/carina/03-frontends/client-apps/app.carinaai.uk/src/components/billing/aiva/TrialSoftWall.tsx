'use client';

import Link from 'next/link';

export type SoftWallPack = {
  id: string;
  label: string;
  amountGbp: number;
  messages: number;
};

/**
 * Soft wall after trial credit / trial days end.
 * Paths: BYOK, quiet prepaid top-up, or subscription upgrade.
 * Prepaid is not marketed on public pricing pages.
 */
export function TrialSoftWall({
  creditExhausted = false,
  packs = [],
  onTopup,
  topupLoadingId = null,
}: {
  creditExhausted?: boolean;
  packs?: SoftWallPack[];
  onTopup?: (packId: string) => void;
  topupLoadingId?: string | null;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <h2 className="text-base font-semibold text-text-primary">
        {creditExhausted ? '£1 trial credit used up' : 'Your trial has ended'}
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        The free £1 managed token allowance has stopped so VERLOX does not keep spending on your behalf.
        Keep using Aiva by choosing one path:
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Free, self-managed
          </p>
          <p className="mt-1 text-sm font-medium text-text-primary">Connect your own API key</p>
          <p className="mt-1 text-xs text-text-secondary">
            Bring OpenAI or Anthropic. You pay the provider directly. Platform access stays free.
          </p>
          <Link
            href="/settings/keys"
            className="mt-3 inline-flex rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-primary hover:border-accent"
          >
            Add BYOK key
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Add managed credit
          </p>
          <p className="mt-1 text-sm font-medium text-text-primary">Top up without a monthly plan</p>
          <p className="mt-1 text-xs text-text-secondary">
            Small one-time credit if you are not ready for Starter yet.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {packs.map((pack) => (
              <button
                key={pack.id}
                type="button"
                disabled={!onTopup || topupLoadingId === pack.id}
                onClick={() => onTopup?.(pack.id)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-primary hover:border-accent disabled:opacity-50"
              >
                {topupLoadingId === pack.id ? 'Starting…' : pack.label}
              </button>
            ))}
          </div>
          {packs[0] ? (
            <p className="mt-2 text-[11px] text-text-muted">
              Example: {packs[0].label} ≈ {packs[0].messages} managed messages
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-accent/40 bg-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Managed plan
          </p>
          <p className="mt-1 text-sm font-medium text-text-primary">Upgrade to Starter (£49/mo)</p>
          <p className="mt-1 text-xs text-text-secondary">
            Best value for ongoing use. Team £99 · Business £199.
          </p>
          <a
            href="#choose-plan"
            className="btn-primary mt-3 inline-flex rounded-lg px-3 py-2 text-xs font-medium"
          >
            Choose a managed plan
          </a>
        </div>
      </div>
    </div>
  );
}
