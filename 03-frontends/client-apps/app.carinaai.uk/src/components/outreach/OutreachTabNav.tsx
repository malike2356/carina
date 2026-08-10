'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/aiva/outreach', label: 'Overview' },
  { href: '/aiva/outreach/leads', label: 'CRM Leads' },
  { href: '/aiva/outreach/pipeline', label: 'Pipeline' },
  { href: '/aiva/outreach/qualification', label: 'Qualify' },
  { href: '/aiva/outreach/replies', label: 'Replies' },
  { href: '/aiva/outreach/bookings', label: 'Bookings' },
  { href: '/aiva/outreach/lists', label: 'Lists' },
  { href: '/aiva/outreach/campaigns', label: 'Campaigns' },
  { href: '/aiva/outreach/sequences', label: 'Sequences' },
  { href: '/aiva/outreach/channels', label: 'Channels' },
  { href: '/aiva/outreach/companies-house', label: 'Companies House' },
  { href: '/aiva/approvals', label: 'Approvals' },
] as const;

export function OutreachTabNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-2 flex flex-wrap gap-0.5 pb-2">
      {TABS.map((tab) => {
        const active = tab.href === '/aiva/outreach'
          ? pathname === tab.href
          : tab.href === '/aiva/approvals'
            ? pathname.startsWith('/aiva/approvals')
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-elevated text-text-primary'
                : 'text-text-secondary hover:bg-elevated hover:text-text-primary'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
