'use client';

import { X } from 'lucide-react';
import { AivaHireFlow } from '@/components/aiva/AivaHireFlow';

type AivaHireDrawerProps = {
  open: boolean;
  onClose: () => void;
  onHired: (workerId: string) => void;
};

export function AivaHireDrawer({ open, onClose, onHired }: AivaHireDrawerProps) {
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
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-base text-text-primary shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="hire-aiva-title" className="text-lg font-semibold text-text-primary">
            Hire an Aiva
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-elevated hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <AivaHireFlow
            compact
            showAllRolesByDefault={false}
            onCancel={onClose}
            onSuccess={(workerId) => {
              onClose();
              onHired(workerId);
            }}
          />
        </div>
      </aside>
    </div>
  );
}
