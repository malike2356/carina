'use client';

import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-danger/30 bg-danger-dim px-4 py-3',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary">{message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 text-xs font-medium text-accent hover:underline"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
