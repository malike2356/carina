'use client';

import { useCallback, useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { AIVA_INPUT_CLASS } from '@/lib/aiva-utils';
import { cn } from '@/lib/utils';

type ServeMode = 'me' | 'both' | 'customers';

type KnowledgeOption = {
  id: string;
  title: string;
  type: string;
  enabled: boolean;
  publishState?: 'draft' | 'published' | 'archived';
  revision?: number;
};

type Readiness = {
  ready: boolean;
  checks: Array<{ key: string; label: string; status: 'done' | 'missing' | 'warning' }>;
  blockers: string[];
  warnings: string[];
};

type SupportCaseRow = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  audienceSessionId: string | null;
  createdAt: string;
};

type ConciergeProfile = {
  published: boolean;
  personaName: string | null;
  greetingMessage: string | null;
  businessName: string | null;
  businessDescription: string | null;
  knowledgeSourceIds: string[];
  channelConfig: {
    web?: { enabled: boolean; originAllowlist?: string[] };
    telegram?: { enabled: boolean };
    whatsapp?: { enabled: boolean };
    email?: { enabled: boolean; address?: string };
    meetingTypes?: Array<{ id: string; name: string; durationMinutes: number; description?: string }>;
  };
  calendarProvider: string | null;
  calendarConnected: boolean;
  conferencingProvider: string | null;
  conferencingConnected: boolean;
  businessHours: {
    timezone: string;
    windows: Array<{ dayOfWeek: number; start: string; end: string }>;
  } | null;
  escalationEmail: string | null;
  tone?: string | null;
  supportedLanguages?: string[];
  responseBoundaries?: string | null;
  bookingPermission?: 'off' | 'offer_only' | 'offer_and_book';
};

type MeetingTypeDraft = {
  name: string;
  durationMinutes: number;
  description: string;
};

const DEFAULT_HOURS = {
  timezone: 'Europe/London',
  windows: [
    { dayOfWeek: 1, start: '09:00', end: '17:00' },
    { dayOfWeek: 2, start: '09:00', end: '17:00' },
    { dayOfWeek: 3, start: '09:00', end: '17:00' },
    { dayOfWeek: 4, start: '09:00', end: '17:00' },
    { dayOfWeek: 5, start: '09:00', end: '17:00' },
  ],
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function btnPrimary(disabled?: boolean) {
  return cn(
    'inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-base font-medium',
    disabled
      ? 'cursor-not-allowed bg-elevated text-text-muted'
      : 'bg-accent text-white hover:opacity-90',
  );
}

function btnSecondary() {
  return 'inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-surface px-4 text-base text-text-primary hover:bg-elevated';
}

export function ConciergeSetupTab({ workerId }: { workerId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<ServeMode>('customers');
  const [profile, setProfile] = useState<ConciergeProfile | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeOption[]>([]);
  const [embed, setEmbed] = useState<{ publicUrl: string; embedSnippet: string } | null>(null);
  const [stats, setStats] = useState({ conversationCountToday: 0, bookingCountToday: 0 });
  const [zoomOAuthConfigured, setZoomOAuthConfigured] = useState(false);
  const [googleOAuthConfigured, setGoogleOAuthConfigured] = useState(false);

  const [personaName, setPersonaName] = useState('Aiva');
  const [greetingMessage, setGreetingMessage] = useState('Hi! I am Aiva. How can I help?');
  const [businessName, setBusinessName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [escalationEmail, setEscalationEmail] = useState('');
  const [knowledgeIds, setKnowledgeIds] = useState<string[]>([]);

  const [webEnabled, setWebEnabled] = useState(true);
  const [originAllowlist, setOriginAllowlist] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [timezone, setTimezone] = useState(DEFAULT_HOURS.timezone);
  const [windows, setWindows] = useState(DEFAULT_HOURS.windows);
  const [calendarProvider, setCalendarProvider] = useState<string>('');
  const [conferencingProvider, setConferencingProvider] = useState<string>('');
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeDraft[]>([
    { name: 'Intro call', durationMinutes: 30, description: '' },
  ]);
  const [zoomToken, setZoomToken] = useState('');
  const [tone, setTone] = useState('helpful and professional');
  const [supportedLanguages, setSupportedLanguages] = useState('en');
  const [responseBoundaries, setResponseBoundaries] = useState(
    'Do not invent legal, medical, or account-access advice.',
  );
  const [bookingPermission, setBookingPermission] = useState<'off' | 'offer_only' | 'offer_and_book'>(
    'offer_and_book',
  );
  const [supportCases, setSupportCases] = useState<SupportCaseRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/concierge/profile`);
      const data = (await res.json()) as {
        profile?: ConciergeProfile | null;
        readiness?: Readiness;
        knowledge?: KnowledgeOption[];
        embed?: { publicUrl: string; embedSnippet: string } | null;
        stats?: { conversationCountToday?: number; bookingCountToday?: number };
        zoomOAuthConfigured?: boolean;
        googleOAuthConfigured?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Could not load concierge profile');
        return;
      }
      setKnowledge(data.knowledge ?? []);
      setReadiness(data.readiness ?? null);
      setEmbed(data.embed ?? null);
      setStats({
        conversationCountToday: data.stats?.conversationCountToday ?? 0,
        bookingCountToday: data.stats?.bookingCountToday ?? 0,
      });
      setZoomOAuthConfigured(Boolean(data.zoomOAuthConfigured));
      setGoogleOAuthConfigured(Boolean(data.googleOAuthConfigured));
      const p = data.profile ?? null;
      setProfile(p);
      if (p) {
        setMode('customers');
        setPersonaName(p.personaName ?? 'Aiva');
        setGreetingMessage(p.greetingMessage ?? '');
        setBusinessName(p.businessName ?? '');
        setBusinessDescription(p.businessDescription ?? '');
        setEscalationEmail(p.escalationEmail ?? '');
        setKnowledgeIds(p.knowledgeSourceIds ?? []);
        setWebEnabled(Boolean(p.channelConfig?.web?.enabled));
        setOriginAllowlist((p.channelConfig?.web?.originAllowlist ?? []).join(', '));
        setTelegramEnabled(Boolean(p.channelConfig?.telegram?.enabled));
        setWhatsappEnabled(Boolean(p.channelConfig?.whatsapp?.enabled));
        setEmailEnabled(Boolean(p.channelConfig?.email?.enabled));
        setEmailAddress(p.channelConfig?.email?.address ?? '');
        if (p.businessHours) {
          setTimezone(p.businessHours.timezone);
          setWindows(p.businessHours.windows);
        }
        setCalendarProvider(p.calendarProvider ?? '');
        setConferencingProvider(p.conferencingProvider ?? '');
        if (p.channelConfig?.meetingTypes?.length) {
          setMeetingTypes(
            p.channelConfig.meetingTypes.map((m) => ({
              name: m.name,
              durationMinutes: m.durationMinutes,
              description: m.description ?? '',
            })),
          );
        }
        setTone(p.tone ?? 'helpful and professional');
        setSupportedLanguages((p.supportedLanguages ?? ['en']).join(', '));
        setResponseBoundaries(
          p.responseBoundaries
            ?? 'Do not invent legal, medical, or account-access advice.',
        );
        setBookingPermission(p.bookingPermission ?? 'offer_and_book');
        if (p.channelConfig?.web || p.businessHours) setStep(2);
      }

      try {
        const casesRes = await fetch(`/api/aiva/workers/${workerId}/concierge/support-cases`);
        if (casesRes.ok) {
          const casesData = (await casesRes.json()) as { cases?: SupportCaseRow[] };
          setSupportCases(casesData.cases ?? []);
        }
      } catch {
        setSupportCases([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveStep1() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/concierge/setup/step1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaName,
          greetingMessage,
          businessName,
          businessDescription,
          knowledgeSourceIds: knowledgeIds,
          escalationEmail,
        }),
      });
      const data = (await res.json()) as { error?: string; profile?: ConciergeProfile };
      if (!res.ok) {
        setError(data.error ?? 'Step 1 failed');
        return;
      }
      setProfile(data.profile ?? null);
      setStep(2);
      setNotice('Step 1 saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveStep2() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/concierge/setup/step2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels: {
            web: {
              enabled: webEnabled,
              originAllowlist: originAllowlist
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            },
            telegram: { enabled: telegramEnabled },
            whatsapp: { enabled: whatsappEnabled },
            email: { enabled: emailEnabled, address: emailAddress || undefined },
          },
          businessHours: { timezone, windows },
          calendarProvider: calendarProvider || undefined,
          conferencingProvider: conferencingProvider || undefined,
          meetingTypes: meetingTypes.filter((m) => m.name.trim()),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        profile?: ConciergeProfile;
        readiness?: Readiness;
        actionRequired?: Array<{ label: string; authUrl?: string; message?: string }>;
      };
      if (!res.ok) {
        setError(data.error ?? 'Step 2 failed');
        return;
      }
      setProfile(data.profile ?? null);
      setReadiness(data.readiness ?? null);
      const oauth = data.actionRequired?.find((a) => a.authUrl);
      if (oauth?.authUrl) {
        setNotice(`${oauth.label} needed. Use the connect button below.`);
      } else {
        setNotice('Step 2 saved');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/concierge/publish`, { method: 'POST' });
      const data = (await res.json()) as {
        error?: string;
        publicUrl?: string;
        embedSnippet?: string;
        profile?: ConciergeProfile;
      };
      if (!res.ok) {
        setError(data.error ?? 'Publish failed');
        await load();
        return;
      }
      setNotice('Concierge published');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/concierge/unpublish`, { method: 'POST' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Unpublish failed');
        return;
      }
      setNotice('Concierge unpublished');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function setKnowledgePublish(entryId: string, publishState: 'draft' | 'published' | 'archived') {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/aiva/workers/${workerId}/concierge/knowledge/${entryId}/publish-state`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publishState }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not update publish state');
        return;
      }
      setNotice(`Knowledge marked ${publishState}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function savePolicy() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/concierge/setup/policy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tone,
          supportedLanguages: supportedLanguages
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          responseBoundaries,
          bookingPermission,
        }),
      });
      const data = (await res.json()) as { error?: string; profile?: ConciergeProfile };
      if (!res.ok) {
        setError(data.error ?? 'Could not save policy');
        return;
      }
      setProfile(data.profile ?? null);
      setNotice('Policy saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function releaseCaseToAiva(audienceSessionId: string, caseId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/aiva/workers/${workerId}/concierge/handoff/${audienceSessionId}/release`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not release to Aiva');
        return;
      }
      setNotice('Conversation released to Aiva');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function connectGoogle() {
    const qs = new URLSearchParams({
      workerId,
      toolSlug: 'google-calendar',
      returnPath: `/aiva/workers/${workerId}?tab=concierge`,
    });
    const res = await fetch(`/api/aiva/tools/oauth/google/auth-url?${qs.toString()}`);
    const data = (await res.json()) as { authUrl?: string; error?: string };
    if (!res.ok || !data.authUrl) {
      setError(data.error ?? 'Could not start Google OAuth');
      return;
    }
    window.location.href = data.authUrl;
  }

  async function connectZoomOAuth() {
    const qs = new URLSearchParams({
      workerId,
      returnPath: `/aiva/workers/${workerId}?tab=concierge`,
    });
    const res = await fetch(`/api/aiva/tools/oauth/zoom/auth-url?${qs.toString()}`);
    const data = (await res.json()) as { authUrl?: string; error?: string };
    if (!res.ok || !data.authUrl) {
      setError(data.error ?? 'Could not start Zoom OAuth');
      return;
    }
    window.location.href = data.authUrl;
  }

  async function saveZoomToken() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/aiva/workers/${workerId}/concierge/connections/zoom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: zoomToken }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not store Zoom token');
        return;
      }
      setZoomToken('');
      setNotice('Zoom connected');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (profile?.published) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 overflow-y-auto p-4 text-base">
        <h2 className="text-lg font-semibold text-text-primary">Concierge live</h2>
        <p className="text-sm text-text-muted">
          {profile.personaName} is serving customers for {profile.businessName}.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-text-muted">Conversations today</div>
            <div className="text-xl font-semibold">{stats.conversationCountToday}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-text-muted">Bookings today</div>
            <div className="text-xl font-semibold">{stats.bookingCountToday}</div>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-text-primary">
          <li>Web widget: {profile.channelConfig?.web?.enabled ? 'On' : 'Off'}</li>
          <li>
            Calendar: {profile.calendarProvider ?? 'None'}
            {profile.calendarConnected ? ' (connected)' : ''}
          </li>
          <li>
            Conferencing: {profile.conferencingProvider ?? 'None'}
            {profile.conferencingConnected ? ' (connected)' : ''}
          </li>
        </ul>
        {embed ? (
          <div className="space-y-2">
            <a
              href={embed.publicUrl}
              target="_blank"
              rel="noreferrer"
              className={btnSecondary()}
            >
              Preview as customer
            </a>
            <label className="block text-sm text-text-muted">Embed snippet</label>
            <textarea
              readOnly
              className={cn(AIVA_INPUT_CLASS, 'min-h-24 font-mono text-xs')}
              value={embed.embedSnippet}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-sm font-medium text-text-primary">Knowledge publish state</div>
          {knowledge.length === 0 ? (
            <p className="text-sm text-text-muted">No knowledge entries.</p>
          ) : (
            knowledge.map((k) => (
              <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="flex-1">
                  {k.title} [{k.publishState ?? 'draft'}]
                </span>
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                  onClick={() => void setKnowledgePublish(k.id, 'published')}
                >
                  Publish
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                  onClick={() => void setKnowledgePublish(k.id, 'draft')}
                >
                  Draft
                </button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-text-primary">Answer policy</div>
          <input
            className={AIVA_INPUT_CLASS}
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Tone"
          />
          <input
            className={AIVA_INPUT_CLASS}
            value={supportedLanguages}
            onChange={(e) => setSupportedLanguages(e.target.value)}
            placeholder="Languages (comma-separated)"
          />
          <textarea
            className={cn(AIVA_INPUT_CLASS, 'min-h-20')}
            value={responseBoundaries}
            onChange={(e) => setResponseBoundaries(e.target.value)}
            placeholder="Response boundaries"
          />
          <select
            className={AIVA_INPUT_CLASS}
            value={bookingPermission}
            onChange={(e) =>
              setBookingPermission(e.target.value as 'off' | 'offer_only' | 'offer_and_book')
            }
          >
            <option value="offer_and_book">Offer and book</option>
            <option value="offer_only">Offer only</option>
            <option value="off">Booking off</option>
          </select>
          <button type="button" disabled={saving} onClick={() => void savePolicy()} className={btnSecondary()}>
            Save policy
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-text-primary">Support cases</div>
          {supportCases.length === 0 ? (
            <p className="text-sm text-text-muted">No open support cases yet.</p>
          ) : (
            supportCases.map((c) => (
              <div key={c.id} className="space-y-2 rounded-md border border-border p-3 text-sm">
                <div className="font-medium">{c.subject}</div>
                <div className="text-text-muted">
                  {c.status} / {c.priority}
                </div>
                {c.audienceSessionId ? (
                  <button
                    type="button"
                    disabled={saving}
                    className={btnSecondary()}
                    onClick={() => void releaseCaseToAiva(c.audienceSessionId!, c.id)}
                  >
                    Release to Aiva
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>

        <button type="button" disabled={saving} onClick={() => void unpublish()} className={btnPrimary(saving)}>
          Unpublish
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {notice ? <p className="text-sm text-text-muted">{notice}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 overflow-y-auto p-4 text-base">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Concierge Setup</h2>
        <p className="text-sm text-text-muted">
          Step {step} of 2. Switch this worker from owner assistant to customer-facing concierge.
        </p>
      </div>

      {mode === 'me' ? (
        <div className="space-y-3 rounded-md border border-border p-4">
          <p className="text-sm text-text-muted">
            This worker stays as your private assistant. No public widget will be published.
          </p>
          {profile ? (
            <button type="button" disabled={saving} onClick={() => void unpublish()} className={btnSecondary()}>
              Keep unpublished
            </button>
          ) : null}
        </div>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">Who should Aiva serve?</legend>
        {(
          [
            ['me', 'Me only (assistant)'],
            ['both', 'Me and my customers'],
            ['customers', 'My customers only (concierge)'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3">
            <input
              type="radio"
              name="serve-mode"
              checked={mode === value}
              onChange={() => setMode(value)}
              className="h-4 w-4"
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {mode !== 'me' && step === 1 ? (
        <div className="flex flex-col gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-text-muted">Persona name</span>
            <input className={AIVA_INPUT_CLASS} value={personaName} onChange={(e) => setPersonaName(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-text-muted">Greeting message</span>
            <textarea
              className={cn(AIVA_INPUT_CLASS, 'min-h-24')}
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-text-muted">Business name</span>
            <input className={AIVA_INPUT_CLASS} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-text-muted">Business description</span>
            <textarea
              className={cn(AIVA_INPUT_CLASS, 'min-h-24')}
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-text-muted">Escalation email</span>
            <input
              type="email"
              className={AIVA_INPUT_CLASS}
              value={escalationEmail}
              onChange={(e) => setEscalationEmail(e.target.value)}
            />
          </label>
          <div className="space-y-2">
            <div className="text-sm text-text-muted">Published knowledge sources</div>
            {knowledge.length === 0 ? (
              <p className="text-sm text-text-muted">No knowledge entries yet. Add docs under Training.</p>
            ) : (
              knowledge.map((k) => (
                <div key={k.id} className="space-y-2 rounded-md border border-border px-3 py-2">
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={knowledgeIds.includes(k.id)}
                      onChange={(e) => {
                        setKnowledgeIds((prev) =>
                          e.target.checked ? [...prev, k.id] : prev.filter((id) => id !== k.id),
                        );
                      }}
                    />
                    <span className="flex-1">
                      {k.title}
                      {!k.enabled ? ' (not enabled)' : ''}
                      {k.publishState ? ` [${k.publishState}]` : ''}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving || k.publishState === 'published'}
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => void setKnowledgePublish(k.id, 'published')}
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={saving || k.publishState === 'draft'}
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => void setKnowledgePublish(k.id, 'draft')}
                    >
                      Draft
                    </button>
                    <button
                      type="button"
                      disabled={saving || k.publishState === 'archived'}
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => void setKnowledgePublish(k.id, 'archived')}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <button type="button" disabled={saving} onClick={() => void saveStep1()} className={btnPrimary(saving)}>
            Next
          </button>
        </div>
      ) : null}

      {mode !== 'me' && step === 2 ? (
        <div className="flex flex-col gap-4">
          <button type="button" className="text-left text-sm text-accent" onClick={() => setStep(1)}>
            Back to step 1
          </button>

          <div className="space-y-2">
            <div className="text-sm font-medium">Answer policy</div>
            <input
              className={AIVA_INPUT_CLASS}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Tone"
            />
            <input
              className={AIVA_INPUT_CLASS}
              value={supportedLanguages}
              onChange={(e) => setSupportedLanguages(e.target.value)}
              placeholder="Languages (comma-separated)"
            />
            <textarea
              className={cn(AIVA_INPUT_CLASS, 'min-h-20')}
              value={responseBoundaries}
              onChange={(e) => setResponseBoundaries(e.target.value)}
              placeholder="Response boundaries"
            />
            <select
              className={AIVA_INPUT_CLASS}
              value={bookingPermission}
              onChange={(e) =>
                setBookingPermission(e.target.value as 'off' | 'offer_only' | 'offer_and_book')
              }
            >
              <option value="offer_and_book">Offer and book</option>
              <option value="offer_only">Offer only</option>
              <option value="off">Booking off</option>
            </select>
            <button type="button" disabled={saving} onClick={() => void savePolicy()} className={btnSecondary()}>
              Save policy
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Channels</div>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={webEnabled} onChange={(e) => setWebEnabled(e.target.checked)} />
              Web widget
            </label>
            {webEnabled ? (
              <input
                className={AIVA_INPUT_CLASS}
                placeholder="Origin allowlist (comma-separated)"
                value={originAllowlist}
                onChange={(e) => setOriginAllowlist(e.target.value)}
              />
            ) : null}
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={telegramEnabled} onChange={(e) => setTelegramEnabled(e.target.checked)} />
              Telegram
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={whatsappEnabled} onChange={(e) => setWhatsappEnabled(e.target.checked)} />
              WhatsApp
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
              Email
            </label>
            {emailEnabled ? (
              <input
                className={AIVA_INPUT_CLASS}
                placeholder="Public email address"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Business hours</div>
            <input
              className={AIVA_INPUT_CLASS}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Timezone"
            />
            {windows.map((w, idx) => (
              <div key={`${w.dayOfWeek}-${idx}`} className="flex flex-wrap gap-2">
                <select
                  className={cn(AIVA_INPUT_CLASS, 'min-h-11 w-24')}
                  value={w.dayOfWeek}
                  onChange={(e) => {
                    const dayOfWeek = Number(e.target.value);
                    setWindows((prev) => prev.map((row, i) => (i === idx ? { ...row, dayOfWeek } : row)));
                  }}
                >
                  {DAY_LABELS.map((label, day) => (
                    <option key={label} value={day}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className={cn(AIVA_INPUT_CLASS, 'min-h-11 w-28')}
                  value={w.start}
                  onChange={(e) => {
                    const start = e.target.value;
                    setWindows((prev) => prev.map((row, i) => (i === idx ? { ...row, start } : row)));
                  }}
                />
                <input
                  className={cn(AIVA_INPUT_CLASS, 'min-h-11 w-28')}
                  value={w.end}
                  onChange={(e) => {
                    const end = e.target.value;
                    setWindows((prev) => prev.map((row, i) => (i === idx ? { ...row, end } : row)));
                  }}
                />
                <button
                  type="button"
                  className="min-h-11 px-3 text-sm text-danger"
                  onClick={() => setWindows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className={btnSecondary()}
              onClick={() =>
                setWindows((prev) => [...prev, { dayOfWeek: 1, start: '09:00', end: '17:00' }])
              }
            >
              Add hours row
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Calendar</div>
            <select
              className={cn(AIVA_INPUT_CLASS, 'min-h-11')}
              value={calendarProvider}
              onChange={(e) => setCalendarProvider(e.target.value)}
            >
              <option value="">None</option>
              <option value="google">Google</option>
              <option value="microsoft">Microsoft</option>
              <option value="caldav">CalDAV</option>
            </select>
            {calendarProvider === 'google' && googleOAuthConfigured ? (
              <button type="button" className={btnSecondary()} onClick={() => void connectGoogle()}>
                Connect Google Calendar
              </button>
            ) : null}
            {profile?.calendarConnected ? (
              <p className="text-sm text-text-muted">Calendar connected</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Conferencing</div>
            <select
              className={cn(AIVA_INPUT_CLASS, 'min-h-11')}
              value={conferencingProvider}
              onChange={(e) => setConferencingProvider(e.target.value)}
            >
              <option value="">None</option>
              <option value="zoom">Zoom</option>
              <option value="google_meet">Google Meet</option>
            </select>
            {conferencingProvider === 'zoom' && zoomOAuthConfigured ? (
              <button type="button" className={btnSecondary()} onClick={() => void connectZoomOAuth()}>
                Connect Zoom
              </button>
            ) : null}
            {conferencingProvider === 'zoom' && !zoomOAuthConfigured ? (
              <div className="space-y-2">
                <input
                  className={AIVA_INPUT_CLASS}
                  placeholder="Zoom access token"
                  value={zoomToken}
                  onChange={(e) => setZoomToken(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!zoomToken.trim() || saving}
                  className={btnSecondary()}
                  onClick={() => void saveZoomToken()}
                >
                  Store Zoom token
                </button>
              </div>
            ) : null}
            {profile?.conferencingConnected ? (
              <p className="text-sm text-text-muted">Conferencing connected</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Meeting types</div>
            {meetingTypes.map((mt, idx) => (
              <div key={idx} className="space-y-2 rounded-md border border-border p-3">
                <input
                  className={AIVA_INPUT_CLASS}
                  placeholder="Name"
                  value={mt.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setMeetingTypes((prev) => prev.map((row, i) => (i === idx ? { ...row, name } : row)));
                  }}
                />
                <select
                  className={cn(AIVA_INPUT_CLASS, 'min-h-11')}
                  value={mt.durationMinutes}
                  onChange={(e) => {
                    const durationMinutes = Number(e.target.value);
                    setMeetingTypes((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, durationMinutes } : row)),
                    );
                  }}
                >
                  {[15, 30, 45, 60].map((mins) => (
                    <option key={mins} value={mins}>
                      {mins} minutes
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="min-h-11 text-sm text-danger"
                  onClick={() => setMeetingTypes((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Delete
                </button>
              </div>
            ))}
            <button
              type="button"
              className={btnSecondary()}
              onClick={() =>
                setMeetingTypes((prev) => [...prev, { name: '', durationMinutes: 30, description: '' }])
              }
            >
              Add meeting type
            </button>
          </div>

          <button type="button" disabled={saving} onClick={() => void saveStep2()} className={btnPrimary(saving)}>
            Save channels and calendar
          </button>

          {readiness ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="text-sm font-medium">Readiness</div>
              {readiness.checks.map((c) => (
                <div key={c.key} className="flex justify-between text-sm">
                  <span>{c.label}</span>
                  <span className="text-text-muted">{c.status}</span>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            disabled={saving || !readiness?.ready}
            onClick={() => void publish()}
            className={btnPrimary(saving || !readiness?.ready)}
          >
            Publish
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {notice ? <p className="text-sm text-text-muted">{notice}</p> : null}
    </div>
  );
}
