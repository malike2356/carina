'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminSignOutButton } from '@/components/AdminSignOutButton';
import { ADMIN_NAV_ITEMS } from '@/lib/admin-nav';

function navActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useVaQueueBadge(): { count: number; critical: boolean } | null {
  const pathname = usePathname();
  const [badge, setBadge] = useState<{ count: number; critical: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/va/queue?status=open&limit=1')
      .then((res) => res.json())
      .then((data: { counts?: { unassigned?: number; in_progress?: number; sla_breached?: number } }) => {
        if (cancelled) return;
        const counts = data.counts ?? {};
        const count = Number(counts.unassigned ?? 0) + Number(counts.in_progress ?? 0);
        setBadge({
          count,
          critical: Number(counts.sla_breached ?? 0) > 0,
        });
      })
      .catch(() => {
        if (!cancelled) setBadge(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return badge;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const vaBadge = useVaQueueBadge();

  return (
    <aside className="fixed top-10 bottom-0 left-0 z-40 flex w-52 flex-col border-r border-border bg-elevated py-4">
      <nav className="flex-1 space-y-0.5 px-2">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = navActive(pathname, item.href);
          const isVaQueue = item.href === '/va-queue';
          const badgeCount = isVaQueue ? vaBadge?.count ?? 0 : 0;
          const badgeCritical = isVaQueue ? vaBadge?.critical ?? false : false;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-2 rounded-md border-l-2 px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'border-amber-400 bg-amber-500/10 text-amber-400'
                  : 'border-transparent text-text-secondary hover:bg-overlay hover:text-text-primary',
              ].join(' ')}
            >
              <item.Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {badgeCount > 0 ? (
                <span
                  className={[
                    'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    badgeCritical
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-amber-500/20 text-amber-400',
                  ].join(' ')}
                >
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-border px-4 py-3">
        <AdminSignOutButton />
      </div>
    </aside>
  );
}
