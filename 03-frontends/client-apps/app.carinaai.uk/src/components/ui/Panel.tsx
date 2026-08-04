'use client';

import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';
import { cn } from '@/lib/utils';

interface PanelProps {
  title: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  className?: string;
}

export function Panel({ title, icon, onClose, children, width = 380, className }: PanelProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className={cn(
          'fixed left-1/2 top-16 z-50 flex max-h-[calc(100vh-5rem)] -translate-x-1/2 flex-col rounded-2xl border border-border bg-surface shadow-2xl',
          className,
        )}
        style={{ width }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          {icon && <span className="text-accent">{icon}</span>}
          <h2 className="flex-1 text-sm font-semibold text-text-primary">{title}</h2>
          <IconButton label="Close panel" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
}
