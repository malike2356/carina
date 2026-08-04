'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/vical', label: 'Hub' },
  { href: '/vical/event-types', label: 'Event types' },
  { href: '/vical/availability', label: 'Availability' },
  { href: '/vical/bookings', label: 'Bookings' },
  { href: '/vical/calendar', label: 'Calendar' },
] as const;

export function VicalTabNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active =
          tab.href === '/vical'
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
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
