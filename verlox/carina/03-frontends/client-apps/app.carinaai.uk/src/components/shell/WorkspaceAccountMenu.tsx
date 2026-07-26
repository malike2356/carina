'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CreditCard, LogIn, LogOut, Settings, User } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type WorkspaceAccountMenuProps = {
  userEmail: string;
  userName: string;
  className?: string;
};

export function WorkspaceAccountMenu({
  userEmail,
  userName,
  className,
}: WorkspaceAccountMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const displayName = userName.trim() || userEmail;
  const initials = (displayName || 'User').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function navigate(destination: string) {
    setOpen(false);
    window.location.assign(destination);
  }

  async function leaveWorkspace(destination: '/login') {
    setOpen(false);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign(destination);
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Account menu for ${displayName}`}
        aria-expanded={open}
        aria-controls={menuId}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-text-primary transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {initials}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-[120] mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card text-text-primary shadow-2xl"
        >
          <div className="border-b border-border px-3 py-3">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-text-muted">{userEmail}</p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => navigate('/settings?section=account')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-elevated"
            >
              <User className="h-4 w-4 text-text-muted" aria-hidden />
              Profile and account
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => navigate('/settings')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-elevated"
            >
              <Settings className="h-4 w-4 text-text-muted" aria-hidden />
              Workspace settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => navigate('/billing/aiva')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-elevated"
            >
              <CreditCard className="h-4 w-4 text-text-muted" aria-hidden />
              Billing
            </button>
          </div>
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => void leaveWorkspace('/login')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-text-muted hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => void leaveWorkspace('/login')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-text-muted hover:bg-elevated hover:text-text-primary"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Log in with another account
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
