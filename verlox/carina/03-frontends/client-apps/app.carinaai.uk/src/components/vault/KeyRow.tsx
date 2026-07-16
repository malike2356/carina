'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function KeyRow({
  provider,
  keyHint,
  onDelete,
  disabled,
}: {
  provider: string;
  keyHint: string;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="font-medium capitalize text-text-primary">{provider}</p>
        <p className="text-sm text-text-muted">****...{keyHint}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={disabled} aria-label={`Remove ${provider} key`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
