'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

type AivaHireDrawerProps = {
  open: boolean;
  onClose: () => void;
  onHired: (workerId: string) => void;
};

export function AivaHireDrawer({ open, onClose }: AivaHireDrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" role="presentation">
      <button
        type="button"
        aria-label="Close hire panel"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hire-aiva-title"
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-border bg-base p-6 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="hire-aiva-title" className="text-xl font-semibold text-text-primary">
            Hire an Aiva
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted hover:bg-elevated hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-text-muted">
          Choose a role, channels, and guardrails in the guided provisioning flow.
        </p>
        <Link
          href="/aiva/provision"
          onClick={onClose}
          className="btn-primary mt-6 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium"
        >
          Continue to hire
        </Link>
      </aside>
    </div>
  );
}
