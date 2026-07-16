'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BUSINESS_LINKS = [
  { href: '/customers', label: 'Customers' },
  { href: '/fleet', label: 'Fleet' },
  { href: '/va-queue', label: 'VA Queue' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/audit-log', label: 'Audit Log' },
  { href: '/partners', label: 'Partners' },
  { href: '/marketplace', label: 'Marketplace' },
] as const;

export function OpsBusinessChrome() {
  const pathname = usePathname() ?? '/customers';

  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-4">
      <a
        href="/"
        target="_top"
        rel="noopener"
        className="text-xs font-medium tracking-wide text-accent hover:underline"
      >
        ← VERLOX Console
      </a>
      <nav className="flex flex-wrap items-center gap-1 text-xs" aria-label="Business admin">
        {BUSINESS_LINKS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-md px-2.5 py-1 transition-colors',
                active
                  ? 'bg-amber-500/15 font-medium text-amber-400'
                  : 'text-text-muted hover:bg-overlay hover:text-text-primary',
              ].join(' ')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
