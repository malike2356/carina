'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function MobileSheet({
  open,
  onClose,
  title,
  children,
  className,
}: MobileSheetProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:flex lg:items-center lg:justify-center lg:p-4">
      <button
        type="button"
        aria-label="Close sheet"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Sheet'}
        className={cn(
          'absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-base shadow-lg',
          'pb-[env(safe-area-inset-bottom,0px)]',
          'lg:relative lg:inset-auto lg:w-full lg:max-w-md lg:rounded-xl',
          className,
        )}
      >
        <div className="flex shrink-0 flex-col border-b border-border">
          <div className="flex justify-center pt-2 lg:hidden" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            {title ? (
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
                {title}
              </h3>
            ) : (
              <span className="flex-1" />
            )}
            <button
              type="button"
              onClick={onClose}
              className="touch-target inline-flex items-center justify-center text-text-muted hover:text-text-primary"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
