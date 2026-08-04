import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function AgentOsShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[90rem] space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
          {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </main>
  );
}

export function AgentOsGlanceCard({
  title,
  value,
  copy,
  className,
}: {
  title: string;
  value?: ReactNode;
  copy?: string;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{title}</p>
      {value ? <div className="mt-2 text-xl font-semibold text-text-primary">{value}</div> : null}
      {copy ? <p className="mt-1 text-xs text-text-muted">{copy}</p> : null}
    </section>
  );
}

export default AgentOsShell;
