'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  MobileSkeleton,
  MobileTabs,
} from '@/components/aiva/mobile';
import { OriginFilterChips } from '@/components/ui/OriginFilterChips';
import { INBOX_ORIGIN_HELPER_TEXT, type OriginFilter } from '@/lib/sync-ownership';
import { EmailApprovalInboxClient } from './EmailApprovalInboxClient';
import { SocialApprovalInboxClient } from './SocialApprovalInboxClient';
import { SocialApprovalSettingsPanel } from '@/components/aiva/SocialApprovalSettingsPanel';

type InboxTab = 'email' | 'channels' | 'social';

function tabFromSearch(raw: string | null): InboxTab {
  if (raw === 'social') return 'social';
  if (raw === 'channels' || raw === 'messaging') return 'channels';
  return 'email';
}

export function AivaApprovalsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<InboxTab>(() => tabFromSearch(searchParams.get('tab')));
  const [originFilter, setOriginFilter] = useState<OriginFilter>('aiva');

  useEffect(() => {
    setTab(tabFromSearch(searchParams.get('tab')));
  }, [searchParams]);

  const tabs = useMemo(
    () => [
      { id: 'email', label: 'Email' },
      { id: 'channels', label: 'Channels' },
      { id: 'social', label: 'Social' },
    ],
    [],
  );

  function changeTab(id: string) {
    const next = tabFromSearch(id);
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'email') params.delete('tab');
    else params.set('tab', next);
    const query = params.toString();
    router.replace(query ? `/aiva/approvals?${query}` : '/aiva/approvals', { scroll: false });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Approvals</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Approve drafts before your Aivas send on email, messaging, or social.
          </p>
        </div>
        <Link
          href="/aiva/escalations"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-text-primary hover:bg-overlay"
        >
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden />
          Escalations
        </Link>
      </div>

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
        <SocialApprovalSettingsPanel />
      </div>

      <div className="mb-5">
        <MobileTabs
          tabs={tabs}
          activeId={tab}
          onChange={changeTab}
          compact
        />
      </div>

      {originFilter === 'google' || originFilter === 'local'
        ? null
        : tab === 'email'
          ? <EmailApprovalInboxClient embedded />
          : (
            <SocialApprovalInboxClient
              embedded
              channelGroup={tab === 'channels' ? 'messaging' : 'social'}
            />
          )}
    </div>
  );
}

export function InboxLoadingFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <MobileSkeleton variant="list" rows={4} />
    </div>
  );
}
