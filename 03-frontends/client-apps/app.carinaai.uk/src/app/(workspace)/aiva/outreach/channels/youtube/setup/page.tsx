'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { useYouTubeChannelRun } from '@/components/youtube-channel/use-youtube-channel-run';
import type { ChannelDomainDefinition, ChannelNicheDefinition } from '@/components/youtube-channel/types';

export default function YouTubeChannelSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const { run, loading, reload } = useYouTubeChannelRun();

  const [domains, setDomains] = useState<ChannelDomainDefinition[]>([]);
  const [niches, setNiches] = useState<ChannelNicheDefinition[]>([]);
  const [domain, setDomain] = useState('');
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [publishTime, setPublishTime] = useState('18:30');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/aiva/youtube-channel/niches')
      .then((res) => (res.ok ? res.json() : { domains: [], niches: [] }))
      .then((data: { domains?: ChannelDomainDefinition[]; niches?: ChannelNicheDefinition[] }) => {
        const nextDomains = data.domains ?? [];
        const nextNiches = data.niches ?? [];
        setDomains(nextDomains);
        setNiches(nextNiches);
        setDomain((current) => current || nextDomains[0]?.id || '');
      })
      .catch(() => {
        setDomains([]);
        setNiches([]);
      });
  }, []);

  const nichesForDomain = useMemo(
    () => niches.filter((n) => n.domainId === domain),
    [niches, domain],
  );

  const selectedDomain = domains.find((d) => d.id === domain);

  useEffect(() => {
    if (!nichesForDomain.length) {
      setNiche('');
      return;
    }
    setNiche((current) =>
      nichesForDomain.some((n) => n.id === current) ? current : nichesForDomain[0]!.id,
    );
  }, [nichesForDomain]);

  useEffect(() => {
    const connected = searchParams.get('youtube_connected');
    const channelTitle = searchParams.get('channel_title');
    const youtubeError = searchParams.get('youtube_error');
    if (!connected && !youtubeError) return;

    if (connected) {
      push(`YouTube channel connected${channelTitle ? `: ${channelTitle}` : ''}`, 'success');
      void reload();
    } else if (youtubeError) {
      push(`YouTube connection failed: ${youtubeError}`, 'error');
    }

    const next = new URL(window.location.href);
    next.searchParams.delete('youtube_connected');
    next.searchParams.delete('channel_id');
    next.searchParams.delete('channel_title');
    next.searchParams.delete('youtube_error');
    router.replace(`${next.pathname}${next.search}`);
  }, [searchParams, push, reload, router]);

  const createRun = useCallback(async () => {
    if (!domain || !niche || !location.trim()) {
      push('Choose a domain, niche, and focus', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/aiva/youtube-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain,
          niche,
          location: location.trim(),
          publishTime,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        push(data.error ?? 'Could not start the YouTube channel', 'error');
        return;
      }
      push('YouTube channel started', 'success');
      await reload();
    } finally {
      setSubmitting(false);
    }
  }, [domain, niche, location, publishTime, push, reload]);

  const connectYouTube = useCallback(() => {
    window.location.href = `/api/aiva/youtube/oauth/start?returnPath=${encodeURIComponent(
      '/aiva/outreach/channels/youtube/setup',
    )}`;
  }, []);

  const channelConnected = run?.steps['channel-provision']?.status === 'succeeded';

  if (loading) {
    return <div className="p-6 text-sm text-text-muted">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-[90rem] space-y-6 p-6">
      {!run ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">1. Choose domain, niche, and focus</h2>
            <p className="mt-1 text-xs text-text-muted">
              Aiva writes a year of scripts for this niche and focus, then renders and uploads on a schedule.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-secondary">
              Domain ({domains.length} available)
            </span>
            <select
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            {selectedDomain ? (
              <span className="block text-xs text-text-muted">{selectedDomain.description}</span>
            ) : null}
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-secondary">Niche</span>
            <select
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              {nichesForDomain.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-secondary">
              {selectedDomain?.focusLabel ?? 'Focus'}
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={selectedDomain?.focusPlaceholder ?? 'e.g. beginners'}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-text-secondary">Daily publish time</span>
            <input
              type="time"
              value={publishTime}
              onChange={(e) => setPublishTime(e.target.value)}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <Button onClick={() => void createRun()} disabled={submitting}>
            {submitting ? 'Starting...' : 'Start YouTube channel'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">2. Connect your YouTube channel</h2>
            <p className="mt-1 text-xs text-text-muted">
              Google requires an existing YouTube or Brand Account channel; Aiva cannot create one for
              you. Grant access and Aiva will apply branding, then start researching and generating
              content.
            </p>
          </div>
          {channelConnected ? (
            <p className="text-sm text-accent">Channel connected. Advance the workflow from the Overview tab.</p>
          ) : (
            <Button onClick={connectYouTube}>Connect YouTube channel</Button>
          )}
        </div>
      )}
    </div>
  );
}
