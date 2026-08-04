'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/aiva/outreach/channels/youtube', label: 'Overview' },
  { href: '/aiva/outreach/channels/youtube/setup', label: 'Setup' },
  { href: '/aiva/outreach/channels/youtube/content', label: 'Content' },
  { href: '/aiva/outreach/channels/youtube/videos', label: 'Videos' },
  { href: '/aiva/outreach/channels/youtube/analytics', label: 'Analytics' },
  { href: '/aiva/outreach/channels/youtube/leads', label: 'Leads' },
  { href: '/aiva/outreach/channels/youtube/settings', label: 'Settings' },
] as const;

export function YouTubeChannelTabNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex flex-wrap gap-1">
      {TABS.map((tab) => {
        const active = tab.href === '/aiva/outreach/channels/youtube'
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
