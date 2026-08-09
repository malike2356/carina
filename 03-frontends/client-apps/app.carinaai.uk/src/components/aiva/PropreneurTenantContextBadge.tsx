'use client';

type Props = {
  slug?: string | null;
  label?: string | null;
  loading?: boolean;
};

/**
 * Persistent context indicator for the active Propreneur tenant in Aiva UI.
 */
export function PropreneurTenantContextBadge({ slug, label, loading }: Props) {
  if (loading) {
    return (
      <span className="inline-flex min-h-9 items-center rounded-lg border border-border px-3 text-xs text-text-muted" role="status">
        Tenant context…
      </span>
    );
  }

  if (!slug) {
    return (
      <span
        className="inline-flex min-h-9 items-center rounded-lg border border-amber-500/40 px-3 text-xs text-amber-300"
        title="No Propreneur tenant selected"
      >
        Propreneur: not selected
      </span>
    );
  }

  return (
    <span
      className="inline-flex min-h-9 items-center rounded-lg border border-border bg-overlay px-3 text-xs text-text-primary"
      title={`Active Propreneur tenant: ${label ?? slug}`}
    >
      Propreneur: <strong className="ml-1 font-semibold">{label ?? slug}</strong>
    </span>
  );
}
