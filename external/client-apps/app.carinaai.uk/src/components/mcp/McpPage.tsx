'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Save,
  Server,
  TestTube2,
  Trash2,
  CircleCheck,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

type McpTransport = 'stdio' | 'http';

type McpServer = {
  name: string;
  transport: McpTransport;
  command: string | null;
  args: string[];
  url: string | null;
  env: Record<string, string> | null;
  savedConnected: boolean;
  liveConnected: boolean;
  connected: boolean;
  connectedAt: string | null;
  tools: string[];
};

type McpTestResult = {
  ok: boolean;
  testedAt?: string;
  durationMs?: number;
  transport?: McpTransport;
  tools?: Array<{ name: string; description: string }>;
  error?: string;
};

type McpListResponse = {
  servers?: McpServer[];
  summary?: {
    configured?: number;
    liveConnections?: number;
  };
  error?: string;
};

type FormState = {
  name: string;
  transport: McpTransport;
  command: string;
  argsText: string;
  url: string;
  envText: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  transport: 'stdio',
  command: '',
  argsText: '',
  url: '',
  envText: '',
};

function argsToText(args: string[]): string {
  return args.join('\n');
}

function envToText(env: Record<string, string> | null): string {
  if (!env) return '';
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of parseLines(text)) {
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!key || !value) continue;
    env[key] = value;
  }
  return env;
}

function statusLabel(server: McpServer): string {
  if (server.liveConnected) return 'Live';
  if (server.savedConnected) return 'Saved';
  return 'Saved only';
}

function statusClass(server: McpServer): string {
  if (server.liveConnected) return 'text-accent';
  if (server.savedConnected) return 'text-amber-400';
  return 'text-text-muted';
}

function formFromServer(server: McpServer): FormState {
  return {
    name: server.name,
    transport: server.transport,
    command: server.command ?? '',
    argsText: argsToText(server.args ?? []),
    url: server.url ?? '',
    envText: envToText(server.env),
  };
}

export function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [testResult, setTestResult] = useState<McpTestResult | null>(null);

  const selected = useMemo(
    () => servers.find((server) => server.name === selectedName) ?? null,
    [selectedName, servers],
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/mcp');
      const data = (await res.json()) as McpListResponse;
      if (!res.ok) throw new Error(data.error ?? 'Unable to load MCP servers');
      const next = data.servers ?? [];
      setServers(next);
      if (!selectedName && next[0]) {
        setSelectedName(next[0].name);
        setForm(formFromServer(next[0]));
        setIsCreating(false);
      } else if (selectedName) {
        const match = next.find((server) => server.name === selectedName);
        if (match) {
          setForm(formFromServer(match));
          setIsCreating(false);
        }
        if (!match && next[0]) {
          setSelectedName(next[0].name);
          setForm(formFromServer(next[0]));
          setIsCreating(false);
        }
      }
    } catch (err) {
      setServers([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) {
      if (!isCreating) setForm(EMPTY_FORM);
      return;
    }
    setForm(formFromServer(selected));
    setIsCreating(false);
  }, [selected?.name, isCreating]);

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: form.name.trim(),
        transport: form.transport,
        command: form.transport === 'stdio' ? form.command.trim() : undefined,
        args: form.transport === 'stdio' ? parseLines(form.argsText) : undefined,
        url: form.transport === 'http' ? form.url.trim() : undefined,
        env: form.transport === 'stdio' ? parseEnv(form.envText) : undefined,
      };
      const isUpdate = Boolean(selected);
      const endpoint = isUpdate
        ? `/api/mcp/${encodeURIComponent(selected!.name)}`
        : '/api/mcp';
      const method = isUpdate ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({})) as { server?: McpServer; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Unable to save MCP server');
      setNotice(`Saved ${data.server?.name ?? payload.name}`);
      await load();
      if (data.server?.name) {
        setSelectedName(data.server.name);
      }
      setIsCreating(false);
      setTestResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function removeServer() {
    if (!selected) return;
    setError('');
    setNotice('');
    const res = await fetch(`/api/mcp/${encodeURIComponent(selected.name)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Unable to remove MCP server');
      return;
    }
    setNotice(`Removed ${selected.name}`);
    setSelectedName('');
    setForm(EMPTY_FORM);
    setIsCreating(false);
    setTestResult(null);
    await load();
  }

  async function testServer() {
    if (!selected && !form.name.trim()) return;
    setTesting(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: form.name.trim() || selected?.name,
        transport: form.transport,
        command: form.transport === 'stdio' ? form.command.trim() : undefined,
        args: form.transport === 'stdio' ? parseLines(form.argsText) : undefined,
        url: form.transport === 'http' ? form.url.trim() : undefined,
        env: form.transport === 'stdio' ? parseEnv(form.envText) : undefined,
      };
      const target = selected?.name ?? form.name.trim();
      if (!target) throw new Error('name is required');
      const res = await fetch(`/api/mcp/${encodeURIComponent(target)}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as McpTestResult;
      if (!res.ok) throw new Error(data.error ?? 'Test failed');
      setTestResult(data);
      setNotice(`Tested ${target}`);
    } catch (err) {
      setTestResult(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  }

  const configuredCount = servers.length;
  const liveCount = servers.filter((server) => server.liveConnected).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-text-primary">MCP servers</h1>
            <p className="text-xs text-text-muted">
              Save server definitions, inspect live connections, and test endpoints without stubbing the result.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setSelectedName('');
                setForm(EMPTY_FORM);
                setTestResult(null);
                setNotice('');
              }}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New server
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-text-muted">
          <span>{configuredCount} configured</span>
          <span>{liveCount} live</span>
          <span>Test runs a temporary connection and leaves saved config untouched.</span>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        {notice ? <p className="mt-2 text-xs text-accent">{notice}</p> : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[1.1fr_0.95fr]">
        <section className="min-h-0 border-r border-border">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border px-6 py-3 text-xs text-text-muted">
              Configured servers
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {servers.length === 0 ? (
                <div className="px-6 py-8">
                  <EmptyState
                    icon={<Server className="h-5 w-5" />}
                    title="No MCP servers configured"
                    subtitle="Add a server to store its transport, endpoint, and environment settings for this instance."
                    action={(
                      <Button type="button" onClick={() => {
                        setIsCreating(true);
                        setForm(EMPTY_FORM);
                      }}>
                        <Plus className="h-4 w-4" />
                        Add server
                      </Button>
                    )}
                  />
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {servers.map((server) => (
                    <button
                      key={server.name}
                      type="button"
                      onClick={() => {
                        setSelectedName(server.name);
                        setTestResult(null);
                        setNotice('');
                      }}
                      className={cn(
                        'block w-full px-6 py-4 text-left transition-colors hover:bg-elevated',
                        selected?.name === server.name && 'bg-elevated',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-text-primary">{server.name}</p>
                            <span className={cn('text-[11px] font-medium', statusClass(server))}>
                              {statusLabel(server)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-text-muted">
                            {server.transport === 'http'
                              ? server.url || 'No endpoint'
                              : server.command
                                ? [server.command, ...(server.args ?? [])].join(' ')
                                : 'No command'}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-text-muted">
                          <div>{server.tools.length} tools</div>
                          <div>{server.connectedAt ? new Date(server.connectedAt).toLocaleString() : 'Not tested'}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="min-h-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border px-6 py-3 text-xs text-text-muted">
              Server details
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {!selected && !isCreating && !form.name ? (
                <EmptyState
                  icon={<Server className="h-5 w-5" />}
                  title="Select a server"
                  subtitle="Edit its transport and endpoint, then test the connection before saving changes."
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-text-muted">Name</span>
                      <input
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                        placeholder="filesystem"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-text-muted">Transport</span>
                      <select
                        value={form.transport}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            transport: event.target.value === 'http' ? 'http' : 'stdio',
                          }))
                        }
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                      >
                        <option value="stdio">stdio</option>
                        <option value="http">http</option>
                      </select>
                    </label>
                  </div>

                  {form.transport === 'stdio' ? (
                    <>
                      <label className="space-y-1 block">
                        <span className="text-[11px] uppercase tracking-wide text-text-muted">Command</span>
                        <input
                          value={form.command}
                          onChange={(event) => setForm((current) => ({ ...current, command: event.target.value }))}
                          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                          placeholder="npx"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] uppercase tracking-wide text-text-muted">Args</span>
                        <textarea
                          value={form.argsText}
                          onChange={(event) => setForm((current) => ({ ...current, argsText: event.target.value }))}
                          className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                          placeholder={"-y\n@mcp/server-filesystem"}
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] uppercase tracking-wide text-text-muted">Environment</span>
                        <textarea
                          value={form.envText}
                          onChange={(event) => setForm((current) => ({ ...current, envText: event.target.value }))}
                          className="min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                          placeholder={"TOKEN=...\nROOT=/workspace"}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="space-y-1 block">
                      <span className="text-[11px] uppercase tracking-wide text-text-muted">HTTP endpoint</span>
                      <input
                        value={form.url}
                        onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                        placeholder="https://example.com/mcp"
                      />
                    </label>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void testServer()} disabled={testing}>
                      <TestTube2 className="h-4 w-4" />
                      {testing ? 'Testing...' : 'Test connection'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void save()} disabled={saving}>
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    {selected ? (
                      <Button type="button" variant="destructive" onClick={() => void removeServer()}>
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-border bg-elevated px-4 py-3 text-xs text-text-secondary">
                    <div className="flex items-center gap-2 text-text-primary">
                      <CircleCheck className="h-4 w-4 text-accent" />
                      <span className="font-medium">Current state</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div>Saved: {selected?.savedConnected ? 'connected in config' : 'not connected in config'}</div>
                      <div>Live: {selected?.liveConnected ? 'active in runtime' : 'not currently active'}</div>
                      <div>Tools: {selected?.tools.length ?? 0}</div>
                    </div>
                  </div>

                  {testResult ? (
                    <div className="rounded-lg border border-border bg-surface px-4 py-3 text-xs text-text-secondary">
                      <div className="flex items-center gap-2 text-text-primary">
                        <AlertTriangle className="h-4 w-4 text-accent" />
                        <span className="font-medium">Last test</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div>Transport: {testResult.transport ?? selected?.transport}</div>
                        <div>Tools discovered: {testResult.tools?.length ?? 0}</div>
                        <div>Duration: {testResult.durationMs ?? 0}ms</div>
                      </div>
                      {testResult.tools && testResult.tools.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {testResult.tools.slice(0, 8).map((tool) => (
                            <span
                              key={tool.name}
                              className="rounded-full border border-border bg-elevated px-2 py-1 text-[11px] text-text-secondary"
                            >
                              {tool.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
