'use client';

export function AivaWorkerSharingCard({ workerId }: { workerId: string }) {
  const sharePath = `/aiva/workers/${workerId}`;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-text-primary">Sharing</h3>
      <p className="mt-1 text-xs text-text-muted">
        Worker access remains private to this workspace until a sharing policy is configured.
      </p>
      <code className="mt-3 block rounded bg-elevated px-3 py-2 text-xs text-text-secondary">
        {sharePath}
      </code>
    </section>
  );
}

export default AivaWorkerSharingCard;
