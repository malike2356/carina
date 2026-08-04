'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { getBreadcrumbs } from '@/lib/workspace-nav';

interface BreadcrumbProps {
  pageTitle?: string;
  embedded?: boolean;
}

export function Breadcrumb({ pageTitle, embedded = false }: BreadcrumbProps) {
  const pathname = usePathname();
  const [dynamicTitle, setDynamicTitle] = useState('');

  useEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-page-title]');
    setDynamicTitle(el?.dataset.pageTitle ?? '');
  }, [pathname]);

  const crumbs = getBreadcrumbs(pathname);
  if (crumbs.length === 0 || pathname.startsWith('/chat/') || pathname === '/chat') {
    return embedded ? <span className="text-sm font-medium text-text-secondary">Workspace</span> : null;
  }

  const hasTrail = crumbs.length > 1 || Boolean(pageTitle) || Boolean(dynamicTitle);
  if (!hasTrail && !embedded) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={
        embedded
          ? 'flex items-center gap-1.5 text-xs text-text-muted'
          : 'flex items-center gap-1.5 border-b border-border bg-surface px-4 py-2 text-xs text-text-muted'
      }
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const label = isLast ? (pageTitle ?? (dynamicTitle || crumb.label || '')) : crumb.label;
        const hideMiddle = crumbs.length > 2 && index > 0 && index < crumbs.length - 1;

        return (
          <span
            key={crumb.href}
            className={`flex items-center gap-1.5 ${hideMiddle ? 'hidden sm:flex' : ''}`}
          >
            {index > 0 && <ChevronRight className="h-3 w-3 text-text-muted" aria-hidden />}
            {isLast ? (
              <span className="font-medium text-text-secondary" aria-current="page">
                {label || 'Loading...'}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="transition-colors hover:text-text-primary hover:underline underline-offset-2"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
