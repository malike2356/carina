'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  CreditCard,
  LogOut,
  Settings,
  User,
  type LucideIcon,
} from 'lucide-react';
import { signOutAndRedirect } from '@/lib/auth-client';
import {
  AIVA_HOME_ACTION,
  AIVA_PRIMARY_NAV,
  filterAivaNavByFeatures,
} from '@/lib/aiva-nav';
import { useWorkspaceFeatures } from '@/hooks/useWorkspaceFeatures';
import { useApprovalsPendingCount } from '@/hooks/useApprovalsPendingCount';
import { BrandMark } from '@/components/shell/BrandMark';
import { IconButton } from '@/components/ui/IconButton';
import { AivaOrgSwitcher } from '@/components/aiva/AivaOrgSwitcher';
import { cn } from '@/lib/utils';

type AivaSidebarProps = {
  userEmail: string;
  userName: string;
  collapsed?: boolean;
  onCollapse?: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
};

type AccountMenuItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  {
    href: '/settings?section=account',
    label: 'Account',
    description: 'Name, email, and profile',
    icon: User,
  },
  {
    href: '/settings',
    label: 'Settings',
    description: 'Workspace preferences',
    icon: Settings,
  },
  {
    href: '/billing/aiva',
    label: 'Billing',
    description: 'Plan and invoices',
    icon: CreditCard,
  },
];

function navItemClass(active: boolean, accent?: boolean, compact?: boolean): string {
  if (compact) {
    return cn(
      'group flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ease-out',
      'hover:scale-105 active:scale-95',
      accent
        ? 'text-accent hover:bg-accent/15'
        : active
          ? 'bg-accent/15 text-accent ring-1 ring-accent/25'
          : 'text-text-muted hover:bg-elevated hover:text-text-primary hover:ring-1 hover:ring-border',
    );
  }

  return cn(
    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
    'transition-all duration-200 ease-out',
    'hover:translate-x-0.5 active:scale-[0.99]',
    accent
      ? 'text-accent hover:bg-accent/12 hover:shadow-[inset_3px_0_0_0_currentColor]'
      : active
        ? 'bg-accent/10 text-accent shadow-[inset_3px_0_0_0_currentColor]'
        : 'text-text-secondary hover:bg-elevated hover:text-text-primary hover:shadow-[inset_3px_0_0_0_rgba(255,255,255,0.12)]',
  );
}

export function AivaSidebar({
  userEmail,
  userName,
  collapsed = false,
  onCollapse,
  onNavigate,
  mobile = false,
}: AivaSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { byKey } = useWorkspaceFeatures();
  const { count: pendingApprovals } = useApprovalsPendingCount(true);
  const primaryNav = useMemo(() => {
    const enabled: Partial<Record<import('@/lib/workspace-features').WorkspaceFeatureKey, boolean>> = {};
    for (const [key, feature] of Object.entries(byKey)) {
      enabled[key as import('@/lib/workspace-features').WorkspaceFeatureKey] = feature?.enabled !== false;
    }
    return filterAivaNavByFeatures(AIVA_PRIMARY_NAV, enabled);
  }, [byKey]);
  const initials = (userName || userEmail).slice(0, 2).toUpperCase();
  const displayName = userName.trim() || userEmail;

  async function signOut() {
    setMenuOpen(false);
    await signOutAndRedirect();
  }

  function goTo(href: string) {
    setMenuOpen(false);
    onNavigate?.();
    router.push(href);
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const accountMenu = (
    <div
      id={menuId}
      role="menu"
      aria-label="Account menu"
      className={cn(
        'absolute z-40 overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-black/25',
        'origin-bottom transition-all duration-150',
        'opacity-100 translate-y-0 scale-100',
        collapsed && !mobile
          ? 'bottom-0 left-[calc(100%+0.5rem)] w-56'
          : 'bottom-[calc(100%+0.5rem)] left-0 right-0',
      )}
    >
      <div className="border-b border-border px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-text-primary">{displayName}</p>
        <p className="truncate text-xs text-text-muted">{userEmail}</p>
      </div>
      <div className="p-1.5">
        {ACCOUNT_MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              role="menuitem"
              onClick={() => goTo(item.href)}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left',
                'transition-colors duration-150',
                'hover:bg-elevated focus-visible:bg-elevated focus-visible:outline-none',
              )}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-text-secondary">
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-primary">{item.label}</span>
                <span className="block text-[11px] text-text-muted">{item.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-border p-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={() => void signOut()}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm',
            'text-text-muted transition-colors duration-150',
            'hover:bg-danger/10 hover:text-danger',
            'focus-visible:bg-danger/10 focus-visible:text-danger focus-visible:outline-none',
          )}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );

  if (collapsed && !mobile) {
    return (
      <aside className="hidden w-12 flex-col items-center gap-1 border-r border-border bg-surface py-3 lg:flex">
        <IconButton label="Expand sidebar" onClick={onCollapse}>
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </IconButton>
        <Link
          href={AIVA_HOME_ACTION.href}
          title={AIVA_HOME_ACTION.label}
          className={navItemClass(AIVA_HOME_ACTION.match(pathname), true, true)}
        >
          <AIVA_HOME_ACTION.icon className="h-4 w-4" aria-hidden />
        </Link>
        <div className="my-1 h-px w-7 bg-border" />
        {primaryNav.map((item) => {
          const active = item.match(pathname);
          const showBadge = item.href === '/aiva/approvals' && pendingApprovals > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(navItemClass(active, item.accent, true), 'relative')}
            >
              <item.icon
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  'group-hover:scale-110',
                )}
                aria-hidden
              />
              {showBadge ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
                  {pendingApprovals > 99 ? '99+' : pendingApprovals}
                </span>
              ) : null}
            </Link>
          );
        })}
        <div className="flex-1" />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((open) => !open)}
            title={displayName}
            aria-label={`Account menu for ${displayName}`}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              'bg-gradient-to-br from-accent/25 to-accent/10 text-[10px] font-semibold text-accent',
              'ring-2 ring-accent/15 transition-all duration-200',
              'hover:scale-105 hover:ring-accent/40',
              menuOpen && 'scale-105 ring-accent/45',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            )}
          >
            {initials}
          </button>
          {menuOpen ? accountMenu : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between px-4 py-4">
        <Link
          href="/aiva"
          onClick={onNavigate}
          className="shrink-0 transition-opacity duration-150 hover:opacity-90"
        >
          <BrandMark />
        </Link>
        {onCollapse ? (
          <IconButton label={mobile ? 'Close menu' : 'Collapse sidebar'} onClick={onCollapse}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
        ) : null}
      </div>

      <AivaOrgSwitcher />

      <div className="px-3 pb-3">
        <Link
          href={AIVA_HOME_ACTION.href}
          onClick={onNavigate}
          className={cn(
            navItemClass(AIVA_HOME_ACTION.match(pathname), true),
            'border border-border/80 bg-elevated/40',
          )}
        >
          <AIVA_HOME_ACTION.icon className="h-4 w-4 shrink-0" aria-hidden />
          {AIVA_HOME_ACTION.label}
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main">
        {primaryNav.map((item) => {
          const active = item.match(pathname);
          const showBadge = item.href === '/aiva/approvals' && pendingApprovals > 0;
          return (
            <div key={item.href}>
              {item.sectionStart ? <div className="mx-2 my-2 h-px bg-border" /> : null}
              <Link
                href={item.href}
                onClick={onNavigate}
                className={navItemClass(active, item.accent)}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-200',
                    'group-hover:scale-110',
                    active || item.accent ? 'text-accent' : 'text-text-muted group-hover:text-text-primary',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {showBadge ? (
                  <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">
                    {pendingApprovals > 99 ? '99+' : pendingApprovals}
                  </span>
                ) : null}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="relative border-t border-border px-3 py-3" ref={menuRef}>
        {menuOpen ? accountMenu : null}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={`Account menu for ${displayName}`}
          className={cn(
            'group flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-elevated/30 px-2.5 py-2.5 text-left',
            'transition-all duration-200 ease-out',
            'hover:border-accent/35 hover:bg-elevated hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
            menuOpen && 'border-accent/40 bg-elevated shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            'active:scale-[0.985]',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              'bg-gradient-to-br from-accent/25 to-accent/10 text-[11px] font-semibold tracking-wide text-accent',
              'ring-2 ring-accent/15 transition-all duration-200',
              'group-hover:scale-105 group-hover:ring-accent/35',
              menuOpen && 'scale-105 ring-accent/40',
            )}
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-sm font-semibold text-text-primary transition-colors',
                'group-hover:text-accent',
                menuOpen && 'text-accent',
              )}
            >
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-text-muted">{userEmail}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-text-muted transition-all duration-200',
              'group-hover:text-text-secondary',
              menuOpen ? 'rotate-180 text-text-secondary' : 'group-hover:translate-y-0.5',
            )}
            aria-hidden
          />
        </button>
      </div>
    </aside>
  );
}
