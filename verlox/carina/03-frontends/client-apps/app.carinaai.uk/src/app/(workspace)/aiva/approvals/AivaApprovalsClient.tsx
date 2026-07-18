'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  MobileScreen,
  MobileSkeleton,
  MobileTabs,
} from '@/components/aiva/mobile';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import { INBOX_ORIGIN_HELPER_TEXT, type OriginFilter } from '@/lib/sync-ownership';
import { EmailApprovalInboxClient } from './EmailApprovalInboxClient';
import { SocialApprovalInboxClient } from './SocialApprovalInboxClient';

type InboxTab = 'email' | 'social';

export function AivaApprovalsClient() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'social' ? 'social' : 'email';
  const [tab, setTab] = useState<InboxTab>(initialTab);
  const [originFilter, setOriginFilter] = useState<OriginFilter>('aiva');

  const tabs = useMemo(
    () => [
      { id: 'email', label: 'Email' },
      { id: 'social', label: 'Social' },
    ],
    [],
  );

  return (
    <MobileScreen
      title="Inbox"
      subtitle="Review drafts and handoffs that need your approval."
      hideTitleOnMobile
      primaryAction={
        <Link
          href="/aiva/escalations"
          className="hidden min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-text-primary hover:bg-overlay lg:inline-flex"
        >
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
          Escalations
        </Link>
      }
    >
      <Link
        href="/aiva/escalations"
        className="mb-4 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-elevated px-4 text-sm text-text-primary hover:bg-overlay lg:hidden"
      >
        <span className="inline-flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
          VA escalations
        </span>
        <span className="text-xs text-text-muted">Open queue</span>
      </Link>

      <div className="mb-3 space-y-1.5">
        <OriginFilterChips value={originFilter} onChange={setOriginFilter} />
        <p className="text-[11px] text-text-muted">{INBOX_ORIGIN_HELPER_TEXT}</p>
        <p className="text-[11px] text-text-muted">
          Unified origin feed also available at{' '}
          <Link href="/inbox" className="text-accent hover:underline">
            /inbox
          </Link>
          .
        </p>
      </div>

      {originFilter === 'google' || originFilter === 'local' ? (
        <p className="mb-4 rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-text-secondary">
          Approval drafts are Aiva-origin. Switch to All or Aiva, or open{' '}
          <Link href="/inbox" className="text-accent hover:underline">
            /inbox
          </Link>{' '}
          for Google Drive drops.
        </p>
      ) : null}

      <div className="mb-5">
        <MobileTabs
          tabs={tabs}
          activeId={tab}
          onChange={(id) => setTab(id as InboxTab)}
        />
      </div>

      {originFilter === 'google' || originFilter === 'local'
        ? null
        : tab === 'email'
          ? <EmailApprovalInboxClient embedded />
          : <SocialApprovalInboxClient embedded />}
    </MobileScreen>
  );
}

export function InboxLoadingFallback() {
  return (
    <MobileScreen title="Inbox" hideTitleOnMobile>
      <MobileSkeleton variant="list" rows={4} />
    </MobileScreen>
  );
}
