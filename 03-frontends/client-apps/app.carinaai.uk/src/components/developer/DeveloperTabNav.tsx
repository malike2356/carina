'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/developer/keys', label: 'API keys' },
  { href: '/developer/usage', label: 'Usage' },
] as const;

export function DeveloperTabNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex gap-1">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
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
