'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Calendar, FileText, Inbox, LayoutDashboard, MoreHorizontal } from 'lucide-react';
import { useIsAivaProduct } from '@/hooks/useProductSurface';
import { useApprovalsPendingCount } from '@/hooks/useApprovalsPendingCount';
import { cn } from '@/lib/utils';

const AIVA_MOBILE_TABS = [
  {
    href: '/aiva',
    label: 'Home',
    icon: LayoutDashboard,
    match: (pathname: string) =>
      pathname === '/aiva'
      || pathname.startsWith('/aiva/lab')
      || pathname.startsWith('/aiva/hire')
      || pathname.startsWith('/aiva/provision')
      || pathname.startsWith('/aiva/workers')
      || pathname.startsWith('/aiva/canvas'),
  },
  {
    href: '/documents',
    label: 'Docs',
    icon: FileText,
    match: (pathname: string) =>
      pathname.startsWith('/documents')
      || pathname.startsWith('/workspace-ops')
      || pathname.startsWith('/files'),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: Calendar,
    match: (pathname: string) => pathname.startsWith('/calendar'),
  },
  {
    href: '/aiva/approvals',
    label: 'Approvals',
    icon: Inbox,
    match: (pathname: string) =>
      pathname.startsWith('/aiva/approvals')
      || pathname.startsWith('/aiva/escalations')
      || pathname.startsWith('/conversations'),
  },
  {
    href: '/aiva/more',
    label: 'More',
    icon: MoreHorizontal,
    match: (pathname: string) =>
      pathname.startsWith('/aiva/more')
      || pathname.startsWith('/settings')
      || pathname.startsWith('/billing'),
  },
] as const;

const CARINA_MOBILE_TABS = [
  {
    href: '/chat',
    label: 'Chat',
    icon: Bot,
    match: (pathname: string) => pathname === '/chat' || pathname.startsWith('/chat/'),
  },
  {
    href: '/documents',
    label: 'Docs',
    icon: FileText,
    match: (pathname: string) => pathname.startsWith('/documents') || pathname.startsWith('/files'),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: Calendar,
    match: (pathname: string) => pathname.startsWith('/calendar'),
  },
  {
    href: '/inbox',
    label: 'Inbox',
    icon: Inbox,
    match: (pathname: string) => pathname.startsWith('/inbox') || pathname.startsWith('/email'),
  },
  {
    href: '/settings',
    label: 'More',
    icon: MoreHorizontal,
    match: (pathname: string) => pathname.startsWith('/settings') || pathname.startsWith('/billing'),
  },
] as const;

export function MobileBottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const isAiva = useIsAivaProduct();
  const tabs = isAiva ? AIVA_MOBILE_TABS : CARINA_MOBILE_TABS;
  const { count: pendingApprovals } = useApprovalsPendingCount(isAiva);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden',
        'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          const showBadge = isAiva && tab.href === '/aiva/approvals' && pendingApprovals > 0;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  'relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium',
                  active ? 'text-accent' : 'text-text-muted hover:text-text-primary',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden />
                  {showBadge ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
                      {pendingApprovals > 99 ? '99+' : pendingApprovals}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
