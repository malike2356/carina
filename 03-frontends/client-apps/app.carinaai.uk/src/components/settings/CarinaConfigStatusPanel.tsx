'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, RefreshCw, TestTube2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DomainStatus {
  id: string;
  name: string;
  configured: boolean;
}

interface CategoryStatus {
  category: string;
  total: number;
  configured: number;
  domains: DomainStatus[];
}

interface OverviewData {
  totalDomains: number;
  configuredDomains: number;
  categories: CategoryStatus[];
}

const CATEGORY_LABELS: Record<string, string> = {
  provider: 'AI providers',
  model: 'Model defaults',
  workspace: 'Workspace preferences',
  search: 'Search',
  scout: 'Labyrinth Scout',
  integration: 'Integrations',
  voice: 'Voice and TTS',
};

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

interface TestResult {
  success: boolean;
  message: string;
}

export function CarinaConfigStatusPanel() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/core-config/overview', { credentials: 'include' });
      if (!res.ok) {
        setError(res.status === 503 ? 'Carina core not reachable.' : 'Config status unavailable.');
        return;
      }
      const json = (await res.json()) as OverviewData;
      setData(json);
    } catch {
      setError('Could not load configuration status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function toggleCategory(category: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  async function testDomain(domainId: string) {
    setTestStates((prev) => ({ ...prev, [domainId]: 'testing' }));
    setTestMessages((prev) => ({ ...prev, [domainId]: '' }));
    try {
      const res = await fetch('/api/core-config/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId }),
      });
      const json = (await res.json()) as TestResult;
      setTestStates((prev) => ({ ...prev, [domainId]: json.success ? 'ok' : 'fail' }));
      setTestMessages((prev) => ({ ...prev, [domainId]: json.message ?? '' }));
    } catch {
      setTestStates((prev) => ({ ...prev, [domainId]: 'fail' }));
      setTestMessages((prev) => ({ ...prev, [domainId]: 'Test request failed.' }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading configuration status...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
        <XCircle className="h-4 w-4 text-red-400" />
        {error ?? 'No data.'}
      </div>
    );
  }

  const allConfigured = data.configuredDomains === data.totalDomains;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-text-muted">
          {data.configuredDomains} of {data.totalDomains} domains configured
          {allConfigured && <span className="ml-2 text-green-500">All set</span>}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:bg-elevated"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="space-y-2">
        {data.categories.map((cat) => {
          const label = CATEGORY_LABELS[cat.category] ?? cat.category;
          const isExpanded = expanded.has(cat.category);
          const allDone = cat.configured === cat.total;

          return (
            <div key={cat.category} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => toggleCategory(cat.category)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  {allDone ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-text-muted" />
                  )}
                  <span className="text-sm font-medium text-text-primary">{label}</span>
                </div>
                <span className="text-xs text-text-muted">
                  {cat.configured}/{cat.total}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-border px-4 pb-3 pt-2 space-y-1.5">
                  {cat.domains.map((domain) => {
                    const ts = testStates[domain.id] ?? 'idle';
                    const tm = testMessages[domain.id] ?? '';

                    return (
                      <div key={domain.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {domain.configured ? (
                              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 flex-shrink-0 text-text-muted" />
                            )}
                            <span
                              className={cn(
                                'text-xs',
                                domain.configured ? 'text-text-primary' : 'text-text-muted',
                              )}
                            >
                              {domain.name}
                            </span>
                          </div>
                          {domain.configured && (
                            <button
                              type="button"
                              disabled={ts === 'testing'}
                              onClick={() => void testDomain(domain.id)}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-text-muted hover:bg-elevated disabled:opacity-40"
                            >
                              {ts === 'testing' ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <TestTube2 className="h-3 w-3" />
                              )}
                              {ts === 'testing' ? 'Testing...' : 'Test'}
                            </button>
                          )}
                        </div>
                        {tm && (
                          <p
                            className={cn(
                              'ml-5.5 text-xs',
                              ts === 'ok' ? 'text-green-500' : 'text-red-400',
                            )}
                          >
                            {tm}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-muted">
        Talk to Carina to configure any of these: "configure OpenAI", "set up Scout", "add n8n webhook", etc.
      </p>
    </div>
  );
}
