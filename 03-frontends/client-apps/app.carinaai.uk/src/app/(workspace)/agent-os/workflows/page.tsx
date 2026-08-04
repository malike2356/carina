'use client';

import Link from 'next/link';
import { AGENT_OS_WORKFLOWS } from '@/lib/agent-os-workflows';
import { AgentOsShell } from '@/components/agent-os/AgentOsShell';

export default function WorkflowsCatalogPage() {
  return (
    <AgentOsShell
      title="Workflows"
      description="Julian-style recipes on Carina. Ready cards run for real; gated cards explain why."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {AGENT_OS_WORKFLOWS.map((workflow) => (
          <article key={workflow.id} className="rounded-xl border border-border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">{workflow.title}</h2>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-text-muted">
                {workflow.status}
              </span>
            </div>
            <p className="text-xs text-text-muted">{workflow.description}</p>
            <Link
              href={workflow.href}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline"
            >
              {workflow.status === 'ready' ? 'Run' : 'View'}
            </Link>
          </article>
        ))}
      </div>
    </AgentOsShell>
  );
}
