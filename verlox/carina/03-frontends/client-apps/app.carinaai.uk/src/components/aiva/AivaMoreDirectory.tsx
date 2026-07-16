'use client';

import Link from 'next/link';
import { AIVA_MORE_DIRECTORY } from '@/lib/aiva-nav';

export function AivaMoreDirectory() {
  return (
    <div className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">More</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every useful Aiva page in one place. From here, any destination is one click away (at most two
          hops from the sidebar).
        </p>
      </div>

      {AIVA_MORE_DIRECTORY.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {group.title}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-accent/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary">{item.label}</span>
                    <span className="mt-0.5 block text-sm text-text-muted">{item.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
