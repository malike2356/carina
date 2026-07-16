import type { WorkspaceHomeWorker } from '@/lib/workspace-capabilities';

type DomainLayoutProps = {
  worker: WorkspaceHomeWorker;
};

export function PropertyHomeLayout({ worker }: DomainLayoutProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold text-text-primary">Property operations</h2>
      <p className="mt-1 text-sm text-text-muted">
        {worker.name} handles tenant enquiries, maintenance, viewings, and rent follow-ups.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-elevated p-3">
          <p className="text-xs text-text-muted">Tenant enquiries</p>
          <p className="text-sm font-medium text-text-primary">Inbox ready</p>
        </div>
        <div className="rounded-md bg-elevated p-3">
          <p className="text-xs text-text-muted">Maintenance</p>
          <p className="text-sm font-medium text-text-primary">Triage enabled</p>
        </div>
        <div className="rounded-md bg-elevated p-3">
          <p className="text-xs text-text-muted">Viewings</p>
          <p className="text-sm font-medium text-text-primary">Calendar linked</p>
        </div>
      </div>
    </section>
  );
}

export function SupportHomeLayout({ worker }: DomainLayoutProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold text-text-primary">Customer support</h2>
      <p className="mt-1 text-sm text-text-muted">
        {worker.name} answers FAQs, tracks tickets, and escalates complex issues.
      </p>
    </section>
  );
}

export function OutreachHomeLayout({ worker }: DomainLayoutProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold text-text-primary">Sales outreach</h2>
      <p className="mt-1 text-sm text-text-muted">
        {worker.name} qualifies leads, drafts follow-ups, and keeps your pipeline moving.
      </p>
    </section>
  );
}

export function FinanceHomeLayout({ worker }: DomainLayoutProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold text-text-primary">Finance admin</h2>
      <p className="mt-1 text-sm text-text-muted">
        {worker.name} helps with invoices, expenses, and payment reminders.
      </p>
    </section>
  );
}

export function CalendarHomeLayout({ worker }: DomainLayoutProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold text-text-primary">Calendar management</h2>
      <p className="mt-1 text-sm text-text-muted">
        {worker.name} schedules meetings, sends reminders, and keeps your week organised.
      </p>
    </section>
  );
}
