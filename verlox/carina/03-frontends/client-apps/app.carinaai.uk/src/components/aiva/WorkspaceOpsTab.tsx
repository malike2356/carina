export type OpsSection = 'home' | 'capture' | 'files' | 'setup';

export function WorkspaceOpsTab({
  workerId,
  workerName,
  section,
  initialCapture,
  onRequestSection,
}: {
  workerId: string;
  workerName?: string;
  section: OpsSection;
  initialCapture?: string | null;
  onRequestSection: (section: OpsSection) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {workerName || workerId}
      </p>
      <h2 className="mt-1 text-lg font-semibold capitalize text-text-primary">{section}</h2>
      <p className="mt-2 text-sm text-text-muted">
        {initialCapture
          ? `Ready to record ${initialCapture.replaceAll('-', ' ')}.`
          : 'Google Drive workspace operations are scoped to this AI Employee.'}
      </p>
      {section !== 'setup' ? (
        <button
          type="button"
          onClick={() => onRequestSection('setup')}
          className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-accent hover:underline"
        >
          Open Drive setup
        </button>
      ) : null}
    </section>
  );
}
export default WorkspaceOpsTab;
