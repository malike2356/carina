'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, LogIn, LogOut, Settings, User } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

type WorkspaceAccountMenuProps = {
  userEmail: string;
  userName: string;
  className?: string;
};

type MenuCoords = {
  top: number;
  right: number;
};

const MENU_ITEM_CLASS = cn(
  'group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-text-primary',
  'transition-[background-color,color,transform,box-shadow] duration-150 ease-out',
  'hover:translate-x-0.5 hover:bg-elevated hover:shadow-[inset_3px_0_0_0_var(--color-accent)]',
  'active:scale-[0.99]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
);

const MENU_ICON_CLASS =
  'h-4 w-4 shrink-0 text-text-muted transition-colors duration-150 ease-out group-hover:text-accent';

export function WorkspaceAccountMenu({
  userEmail,
  userName,
  className,
}: WorkspaceAccountMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const displayName = userName.trim() || userEmail;
  const initials = (displayName || 'User').slice(0, 2).toUpperCase();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    function syncPosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setCoords({
        top: Math.round(rect.bottom + 8),
        right: Math.round(Math.max(8, window.innerWidth - rect.right)),
      });
    }

    syncPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);
    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const menu =
    open && coords && mounted
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            style={{ top: coords.top, right: coords.right }}
            className={cn(
              'fixed z-[200] w-64 origin-top-right overflow-hidden rounded-xl border border-border bg-card text-text-primary shadow-2xl',
              'transition-[opacity,transform] duration-150 ease-out',
              'opacity-100 scale-100',
            )}
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
                className={MENU_ITEM_CLASS}
              >
                <User className={MENU_ICON_CLASS} aria-hidden />
                Profile and account
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => navigate('/settings')}
                className={MENU_ITEM_CLASS}
              >
                <Settings className={MENU_ICON_CLASS} aria-hidden />
                Workspace settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => navigate('/billing/aiva')}
                className={MENU_ITEM_CLASS}
              >
                <CreditCard className={MENU_ICON_CLASS} aria-hidden />
                Billing
              </button>
            </div>
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => void leaveWorkspace('/login')}
                className={cn(
                  MENU_ITEM_CLASS,
                  'hover:bg-danger/10 hover:text-danger hover:shadow-[inset_3px_0_0_0_var(--color-danger)]',
                )}
              >
                <LogOut
                  className={cn(MENU_ICON_CLASS, 'group-hover:text-danger')}
                  aria-hidden
                />
                Sign out
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => void leaveWorkspace('/login')}
                className={MENU_ITEM_CLASS}
              >
                <LogIn className={MENU_ICON_CLASS} aria-hidden />
                Log in with another account
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Account menu for ${displayName}`}
        aria-expanded={open}
        aria-controls={menuId}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-text-primary transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {initials}
      </button>
      {menu}
    </div>
  );
}
