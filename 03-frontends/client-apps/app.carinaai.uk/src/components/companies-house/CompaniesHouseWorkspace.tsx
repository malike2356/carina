'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import {
  Building2,
  ExternalLink,
  KeyRound,
  Loader2,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/shell/PageHeader';
import { WorkspaceFeatureGate } from '@/components/workspace/WorkspaceFeatureGate';
import {
  fetchCompaniesHouseStatus,
  fetchCompanyProfile,
  fetchOfficerAppointments,
  searchCompaniesHouse,
  type CompanyOfficer,
  type CompanyProfile,
  type CompanySearchHit,
  type OfficerAppointmentCompany,
  type OfficerSearchHit,
} from '@/lib/companies-house-api';
import { dangerTone, successTone, warnTone } from '@/lib/ui-tones';
import { cn } from '@/lib/utils';

type SearchMode = 'companies' | 'officers';

function statusTone(status: string | null | undefined): 'ok' | 'warn' | 'bad' | 'neutral' {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'ok';
  if (s.includes('liquidation') || s.includes('receivership') || s.includes('administration')) {
    return 'bad';
  }
  if (s.includes('dissolved') || s.includes('converted') || s.includes('closed')) return 'warn';
  return 'neutral';
}

function humanizeType(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/-/g, ' ');
}

function StatusChip({ status }: { status?: string | null }) {
  if (!status) return null;
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold lowercase tracking-wide',
        tone === 'ok' && successTone.chipSoft,
        tone === 'warn' && warnTone.chipSoft,
        tone === 'bad' && dangerTone.chipSoft,
        tone === 'neutral' && 'border border-border text-text-muted',
      )}
    >
      {status}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value?: ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="w-28 shrink-0 text-[11px] uppercase tracking-wide text-text-muted pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-text-secondary">{value}</dd>
    </div>
  );
}

function OfficerRow({ officer }: { officer: CompanyOfficer }) {
  return (
    <div className="grid gap-1 border-b border-border py-2 last:border-0 sm:grid-cols-[1.4fr_0.8fr_0.9fr] sm:gap-3">
      <p className="text-sm font-semibold text-text-primary">{officer.name || 'Unknown'}</p>
      <p className="text-sm capitalize text-text-muted">{officer.officer_role || '-'}</p>
      <p className="text-sm text-text-muted">
        {officer.appointed_on ? `Appointed ${officer.appointed_on}` : ''}
        {officer.resigned_on ? ` · Resigned ${officer.resigned_on}` : ''}
      </p>
    </div>
  );
}

function ProfilePanel({
  profile,
  loading,
  onClose,
  onImport,
  importing,
}: {
  profile: CompanyProfile | null;
  loading: boolean;
  onClose?: () => void;
  onImport?: () => void;
  importing?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <EmptyState
        icon={<Building2 className="h-10 w-10" />}
        title="No company selected"
        subtitle="Choose a search result to inspect status, registered office, SIC codes, and officers."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-snug text-text-primary">
            {profile.company_name || profile.company_number}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusChip status={profile.company_status} />
            {profile.type ? (
              <span className="inline-flex h-5 items-center rounded-md border border-border px-1.5 text-[10px] text-text-muted">
                {humanizeType(profile.type)}
              </span>
            ) : null}
            {profile.has_been_liquidated ? (
              <span className={cn('inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold', warnTone.chipSoft)}>
                Liquidated
              </span>
            ) : null}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
            aria-label="Close profile"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <dl className="rounded-lg border border-border bg-surface/40 px-3 py-1">
        <MetaRow label="Number" value={profile.company_number} />
        <MetaRow label="Incorporated" value={profile.date_of_creation} />
        <MetaRow label="Office" value={profile.registered_office_address?.formatted} />
        <MetaRow
          label="SIC"
          value={
            profile.sic_codes && profile.sic_codes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {profile.sic_codes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex h-5 items-center rounded-md border border-border px-1.5 font-mono text-[10px] text-text-secondary"
                  >
                    {code}
                  </span>
                ))}
              </div>
            ) : null
          }
        />
      </dl>

      {profile.public_url ? (
        <a
          href={profile.public_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          Open on Companies House
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}

      {onImport ? (
        <Button size="sm" onClick={onImport} disabled={importing}>
          {importing ? 'Adding lead...' : 'Add as lead'}
        </Button>
      ) : null}

      <div>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Officers
        </h3>
        <div className="border-t border-border">
          {(profile.officers || []).length === 0 ? (
            <p className="py-3 text-sm text-text-muted">No officers returned for this company.</p>
          ) : (
            (profile.officers || []).slice(0, 20).map((officer, idx) => (
              <OfficerRow key={`${officer.name}-${idx}`} officer={officer} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PersonPanel({
  personName,
  companies,
  loading,
  selectedCompanyNumber,
  onSelectCompany,
  onClose,
}: {
  personName: string | null;
  companies: OfficerAppointmentCompany[];
  loading: boolean;
  selectedCompanyNumber: string | null;
  onSelectCompany: (companyNumber: string) => void;
  onClose?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Loading associated companies...</p>
      </div>
    );
  }

  if (!personName) {
    return (
      <EmptyState
        icon={<UserRound className="h-10 w-10" />}
        title="No person selected"
        subtitle="Search by person name, then choose a match to see every associated company appointment."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-snug text-text-primary">{personName}</h2>
          <p className="mt-1 text-sm text-text-muted">
            {companies.length > 0
              ? `${companies.length} associated compan${companies.length === 1 ? 'y' : 'ies'}`
              : 'No associated companies returned'}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
            aria-label="Close person"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="border-t border-border">
        {companies.length === 0 ? (
          <p className="py-3 text-sm text-text-muted">No appointments found for this officer.</p>
        ) : (
          companies.map((company, idx) => {
            const number = company.company_number || '';
            const active = Boolean(number) && selectedCompanyNumber === number;
            return (
              <button
                key={`${number}-${company.officer_role}-${idx}`}
                type="button"
                disabled={!number}
                onClick={() => number && onSelectCompany(number)}
                className={cn(
                  'w-full border-b border-border px-1 py-3 text-left transition-colors last:border-0',
                  number ? 'hover:bg-surface-elevated/60' : 'opacity-60',
                  active && 'bg-accent/10',
                )}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-text-primary">
                    {company.company_name || number || 'Unknown company'}
                  </span>
                  <StatusChip status={company.company_status} />
                </div>
                <p className="font-mono text-[11px] text-text-muted">
                  {number || 'No company number'}
                  {company.officer_role ? ` · ${humanizeType(company.officer_role)}` : ''}
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  {company.appointed_on ? `Appointed ${company.appointed_on}` : ''}
                  {company.resigned_on ? ` · Resigned ${company.resigned_on}` : ''}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function CompaniesHouseWorkspace({ embedded = false }: { embedded?: boolean }) {
  const { push } = useToast();
  const { data: status, error: statusError } = useSWR(
    'companies-house-status',
    fetchCompaniesHouseStatus,
  );
  const [mode, setMode] = useState<SearchMode>('companies');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyHits, setCompanyHits] = useState<CompanySearchHit[]>([]);
  const [officerHits, setOfficerHits] = useState<OfficerSearchHit[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [selected, setSelected] = useState<CompanyProfile | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string | null>(null);
  const [selectedOfficerName, setSelectedOfficerName] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<OfficerAppointmentCompany[]>([]);
  const [profileBusy, setProfileBusy] = useState(false);
  const [appointmentsBusy, setAppointmentsBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const configured = Boolean(status?.configured && status?.enabled);

  const openProfile = useCallback(async (companyNumber: string) => {
    setSelectedNumber(companyNumber);
    setProfileBusy(true);
    setError(null);
    if (window.matchMedia('(max-width: 767px)').matches) setMobileOpen(true);
    try {
      const profile = await fetchCompanyProfile(companyNumber);
      setSelected(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile load failed');
    } finally {
      setProfileBusy(false);
    }
  }, []);

  const openOfficer = useCallback(async (hit: OfficerSearchHit) => {
    const officerId = (hit.officer_id || '').trim();
    if (!officerId) {
      setError('This person result is missing an officer id for appointments.');
      return;
    }
    setSelectedOfficerId(officerId);
    setSelectedOfficerName(hit.name || 'Officer');
    setSelected(null);
    setSelectedNumber(null);
    setAppointmentsBusy(true);
    setError(null);
    if (window.matchMedia('(max-width: 767px)').matches) setMobileOpen(true);
    try {
      const result = await fetchOfficerAppointments(officerId, { max_items: 50 });
      setAppointments(result.companies || []);
      if (result.name) setSelectedOfficerName(result.name);
    } catch (err) {
      setAppointments([]);
      setError(err instanceof Error ? err.message : 'Could not load associated companies');
    } finally {
      setAppointmentsBusy(false);
    }
  }, []);

  const resetResults = () => {
    setCompanyHits([]);
    setOfficerHits([]);
    setTotal(null);
    setSelected(null);
    setSelectedNumber(null);
    setSelectedOfficerId(null);
    setSelectedOfficerName(null);
    setAppointments([]);
  };

  const onSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const q = query.trim();
    if (!q || !configured) return;
    setBusy(true);
    setError(null);
    resetResults();
    try {
      const result = await searchCompaniesHouse(q, { items_per_page: 20, mode });
      setTotal(typeof result.total_results === 'number' ? result.total_results : null);
      if (mode === 'officers') {
        const items = (result.items || []) as OfficerSearchHit[];
        setOfficerHits(items);
        if (items[0]?.officer_id) {
          await openOfficer(items[0]);
        }
      } else {
        const items = (result.items || []) as CompanySearchHit[];
        setCompanyHits(items);
        if (items[0]?.company_number) {
          await openProfile(items[0].company_number);
        }
      }
    } catch (err) {
      resetResults();
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setBusy(false);
    }
  };

  const importSelectedLead = useCallback(async () => {
    if (!selected) return;
    setImporting(true);
    try {
      const res = await fetch('/api/aiva/outreach/companies-house/import-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyNumber: selected.company_number,
          companyName: selected.company_name || selected.company_number,
          companyStatus: selected.company_status,
          companyType: selected.type,
          registeredOffice: selected.registered_office_address?.formatted,
          sicCodes: selected.sic_codes ?? [],
          officerNames: (selected.officers ?? []).map((officer) => officer.name).filter(Boolean),
          tags: ['companies_house'],
          notes: selected.company_status_detail || '',
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        imported?: boolean;
        duplicateOf?: string;
        error?: string;
      };
      if (!res.ok && !payload.duplicateOf) {
        push(payload.error || 'Could not import company as lead', 'error');
        return;
      }
      push(payload.duplicateOf ? 'Linked to existing lead' : 'Company added as lead', 'success');
    } finally {
      setImporting(false);
    }
  }, [push, selected]);

  const resultLabel = useMemo(() => {
    const count = mode === 'officers' ? officerHits.length : companyHits.length;
    if (total != null) {
      return `Showing ${count.toLocaleString()} of ${total.toLocaleString()}`;
    }
    if (count) return `${count} result${count === 1 ? '' : 's'}`;
    return 'Results';
  }, [companyHits.length, mode, officerHits.length, total]);

  const statusActions = (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex h-6 items-center rounded-md border px-2 text-[11px] font-medium',
          configured
            ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
            : 'border-amber-500/40 text-amber-800 dark:text-amber-300',
        )}
      >
        {configured ? 'Live registry' : 'Key required'}
      </span>
      <Link
        href="/aiva/tools?tool=companies-house"
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
        title="Companies House key and worker grants"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Tools
      </Link>
    </div>
  );

  const detailLoading = mode === 'officers'
    ? (appointmentsBusy || (Boolean(selectedNumber) && profileBusy))
    : profileBusy;

  return (
    <div className={cn('mx-auto max-w-[1400px]', embedded && 'w-full')}>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Companies House</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Search UK companies or people and see associated appointments.
            </p>
          </div>
          {statusActions}
        </div>
      ) : (
        <PageHeader
          title="Companies House"
          description="UK public registry search for companies and people."
          backHref="/aiva/more"
          backLabel="More"
          actions={statusActions}
        />
      )}

      <div className="space-y-4 px-6 py-5">
        {statusError ? (
          <div className={cn('rounded-md px-3 py-2 text-sm', dangerTone.box, dangerTone.text)}>
            {statusError instanceof Error ? statusError.message : 'Could not load integration status'}
          </div>
        ) : null}

        {!configured ? (
          <div className={cn('rounded-md px-3 py-2 text-sm', warnTone.box, warnTone.text)}>
            Add a Companies House API key via{' '}
            <Link href="/aiva/tools?tool=companies-house" className="underline underline-offset-2">
              Tools
            </Link>
            {' '}
            or ask ops to inject COMPANIES_HOUSE_API_KEY on Core.
          </div>
        ) : null}

        {error ? (
          <div className={cn('flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm', dangerTone.box, dangerTone.text)}>
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className={cn('opacity-80 hover:opacity-100', dangerTone.accent)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <form
          onSubmit={onSearch}
          className="rounded-xl border border-border bg-accent/5 p-3 sm:p-4"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!configured || busy}
              onClick={() => {
                setMode('companies');
                resetResults();
              }}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                mode === 'companies'
                  ? 'border-accent bg-accent/15 text-text-primary'
                  : 'border-border text-text-muted hover:bg-surface-elevated hover:text-text-primary',
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              Companies
            </button>
            <button
              type="button"
              disabled={!configured || busy}
              onClick={() => {
                setMode('officers');
                resetResults();
              }}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                mode === 'officers'
                  ? 'border-accent bg-accent/15 text-text-primary'
                  : 'border-border text-text-muted hover:bg-surface-elevated hover:text-text-primary',
              )}
            >
              <UserRound className="h-3.5 w-3.5" />
              People
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!configured || busy}
                placeholder={
                  mode === 'officers'
                    ? 'Person name (e.g. Jane Smith)'
                    : 'Company name or number'
                }
                className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm text-text-primary outline-none ring-accent/40 placeholder:text-text-muted focus:ring-2 disabled:opacity-60"
              />
            </label>
            <Button
              type="submit"
              disabled={!configured || busy || !query.trim()}
              className="h-12 min-w-[128px]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </form>

        <div className="grid min-h-[560px] gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-border md:min-h-[560px]">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="text-xs font-semibold tracking-wide text-text-secondary">{resultLabel}</p>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" /> : null}
            </div>
            {mode === 'officers' ? (
              !officerHits.length ? (
                <div className="flex-1 p-2">
                  <EmptyState
                    icon={<UserRound className="h-10 w-10" />}
                    title={busy ? 'Searching people...' : 'Search by person'}
                    subtitle={
                      busy
                        ? 'Fetching officer matches from Companies House.'
                        : 'Find a person, then open associated companies from their appointments.'
                    }
                    action={
                      !busy && configured ? (
                        <Button variant="outline" size="sm" onClick={() => inputRef.current?.focus()}>
                          Focus search
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <ul className="flex-1 overflow-auto">
                  {officerHits.map((hit, idx) => {
                    const active = selectedOfficerId === hit.officer_id;
                    return (
                      <li key={`${hit.officer_id || hit.name}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => void openOfficer(hit)}
                          className={cn(
                            'w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-elevated/60',
                            active && 'bg-accent/10',
                          )}
                        >
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-text-primary">
                              {hit.name || 'Unknown person'}
                            </span>
                            {typeof hit.appointment_count === 'number' ? (
                              <span className="inline-flex h-5 items-center rounded-md border border-border px-1.5 text-[10px] text-text-muted">
                                {hit.appointment_count} compan{hit.appointment_count === 1 ? 'y' : 'ies'}
                              </span>
                            ) : null}
                          </div>
                          {hit.description ? (
                            <p className="text-sm text-text-muted">{hit.description}</p>
                          ) : null}
                          {hit.address_snippet ? (
                            <p className="mt-1 truncate text-sm text-text-muted">{hit.address_snippet}</p>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : !companyHits.length ? (
              <div className="flex-1 p-2">
                <EmptyState
                  icon={<Search className="h-10 w-10" />}
                  title={busy ? 'Searching registry...' : 'Start a search'}
                  subtitle={
                    busy
                      ? 'Fetching matches from Companies House.'
                      : 'Try a trading name, registered name, or company number.'
                  }
                  action={
                    !busy && configured ? (
                      <Button variant="outline" size="sm" onClick={() => inputRef.current?.focus()}>
                        Focus search
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <ul className="flex-1 overflow-auto">
                {companyHits.map((hit) => {
                  const active = selectedNumber === hit.company_number;
                  return (
                    <li key={`${hit.company_number}-${hit.title}`}>
                      <button
                        type="button"
                        onClick={() => void openProfile(hit.company_number)}
                        className={cn(
                          'w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-elevated/60',
                          active && 'bg-accent/10',
                        )}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-text-primary">
                            {hit.title || hit.company_number}
                          </span>
                          <StatusChip status={hit.company_status} />
                        </div>
                        <p className="font-mono text-[11px] text-text-muted">
                          {hit.company_number}
                          {hit.company_type ? ` · ${humanizeType(hit.company_type)}` : ''}
                          {hit.date_of_creation ? ` · ${hit.date_of_creation}` : ''}
                        </p>
                        {hit.address_snippet ? (
                          <p className="mt-1 truncate text-sm text-text-muted">{hit.address_snippet}</p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {!isMobile ? (
            <section className="min-h-[560px] space-y-4 overflow-auto rounded-xl border border-border p-5">
              {mode === 'officers' ? (
                <>
                  <PersonPanel
                    personName={selectedOfficerName}
                    companies={appointments}
                    loading={appointmentsBusy}
                    selectedCompanyNumber={selectedNumber}
                    onSelectCompany={(companyNumber) => void openProfile(companyNumber)}
                  />
                  {selectedNumber || profileBusy ? (
                    <div className="border-t border-border pt-4">
                      <ProfilePanel
                        profile={selected}
                        loading={profileBusy}
                        onImport={selected ? () => void importSelectedLead() : undefined}
                        importing={importing}
                      />
                    </div>
                  ) : null}
                </>
              ) : (
                <ProfilePanel
                  profile={selected}
                  loading={detailLoading}
                  onImport={selected ? () => void importSelectedLead() : undefined}
                  importing={importing}
                />
              )}
            </section>
          ) : null}
        </div>
      </div>

      {isMobile && mobileOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50">
          <div className="max-h-[86vh] space-y-4 overflow-auto rounded-t-2xl border border-border bg-surface p-4 shadow-xl">
            {mode === 'officers' ? (
              <>
                <PersonPanel
                  personName={selectedOfficerName}
                  companies={appointments}
                  loading={appointmentsBusy}
                  selectedCompanyNumber={selectedNumber}
                  onSelectCompany={(companyNumber) => void openProfile(companyNumber)}
                  onClose={() => setMobileOpen(false)}
                />
                {selectedNumber || profileBusy ? (
                  <div className="border-t border-border pt-4">
                    <ProfilePanel
                      profile={selected}
                      loading={profileBusy}
                      onImport={selected ? () => void importSelectedLead() : undefined}
                      importing={importing}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <ProfilePanel
                profile={selected}
                loading={profileBusy}
                onClose={() => setMobileOpen(false)}
                onImport={selected ? () => void importSelectedLead() : undefined}
                importing={importing}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CompaniesHousePage({ embedded = false }: { embedded?: boolean }) {
  return (
    <WorkspaceFeatureGate feature="ai_agent_tools">
      <CompaniesHouseWorkspace embedded={embedded} />
    </WorkspaceFeatureGate>
  );
}
