'use client';

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { MobileEmptyState } from '@/components/aiva/mobile';

export function InboxEmptyHint({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <MobileEmptyState
      icon={<Inbox className="h-10 w-10" />}
      title="Nothing waiting"
      description={message}
      action={
        actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="btn-primary flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-medium"
          >
            {actionLabel}
          </Link>
        ) : undefined
      }
    />
  );
}
