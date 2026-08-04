'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import type { PlaygroundThinkingLevel } from '@/lib/workspace-llm';

type ModelRow = {
  provider: string;
  model: string;
  label: string;
};

type ChatTurn = {
  role: 'user' | 'assistant';
  content: string;
};

const THINKING_LEVELS: Array<{ id: PlaygroundThinkingLevel; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

const DEFAULT_SYSTEM =
  'You are a helpful assistant inside Aiva Lab Playground. Be clear, practical, and concise unless the user asks for depth.';

export function AivaLabPlayground() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM);
  const [temperature, setTemperature] = useState(1);
  const [thinkingLevel, setThinkingLevel] = useState<PlaygroundThinkingLevel>('high');
  const [webSearch, setWebSearch] = useState(true);
  const [codeExecution, setCodeExecution] = useState(false);
  const [structuredOutputs, setStructuredOutputs] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setModelsLoading(true);
      try {
        const response = await fetch('/api/models');
        const json = (await response.json()) as { data?: ModelRow[] };
        if (!mounted) return;
        const rows = Array.isArray(json.data) ? json.data : [];
        setModels(rows);
        if (rows[0]) {
          setProvider(rows[0].provider);
          setModel(rows[0].model);
        }
      } finally {
        if (mounted) setModelsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, streaming]);

  const modelOptions = useMemo(
    () => models.filter((row) => !provider || row.provider === provider),
    [models, provider],
  );

  const providers = useMemo(
    () => Array.from(new Set(models.map((row) => row.provider))),
    [models],
  );

  function resetChat() {
    abortRef.current?.abort();
    setTurns([]);
    setStreaming('');
    setError(null);
    setBusy(false);
  }

  async function runPrompt() {
    const message = prompt.trim();
    if (!message || busy) return;

    setError(null);
    setBusy(true);
    setStreaming('');
    setPrompt('');
    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content: message }];
    setTurns(nextTurns);

    const controller = new AbortController();
    abortRef.current = controller;
    let assistant = '';

    try {
      const res = await fetch('/api/aiva/lab/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          messages: nextTurns,
          systemPrompt,
          provider: provider || undefined,
          model: model || undefined,
          temperature,
          thinkingLevel,
          tools: {
            webSearch,
            codeExecution,
            structuredOutputs,
          },
        }),
      });

      if (!res.ok || !res.body) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || 'Playground run failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as {
              type?: string;
              content?: string;
              error?: string;
            };
            if (parsed.type === 'error' && parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.type === 'text' && parsed.content) {
              assistant += parsed.content;
              setStreaming(assistant);
            }
          } catch (err) {
            if (err instanceof SyntaxError) continue;
            throw err;
          }
        }
      }

      setTurns((prev) => [...prev, { role: 'assistant', content: assistant || '(empty response)' }]);
      setStreaming('');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (assistant.trim()) {
          setTurns((prev) => [...prev, { role: 'assistant', content: `${assistant}\n\n[stopped]` }]);
          setStreaming('');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Playground run failed');
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="aiva-lab-playground flex h-full min-h-[70vh] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3 sm:px-6">
        <div className="space-y-1">
          <Link
            href="/aiva/lab"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Workspace lab
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden />
            <h1 className="text-xl font-medium tracking-tight text-text-primary sm:text-2xl">
              Lab Playground
            </h1>
          </div>
          <p className="text-sm text-text-secondary">
            Experiment with model, system prompt, temperature, thinking, and tool toggles without leaving Aiva.
          </p>
        </div>
        <button
          type="button"
          onClick={resetChat}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset chat
        </button>
      </div>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex min-h-0 flex-col border-b border-border/80 lg:border-b-0 lg:border-r">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {turns.length === 0 && !streaming ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-elevated/40 px-5 py-8">
                <p className="text-sm font-medium text-text-primary">Start typing a prompt</p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                  Use the Run settings on the right like a studio console. This stays inside the AI-employee OS for
                  demos and operator experiments.
                </p>
              </div>
            ) : null}

            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                className={[
                  'max-w-3xl rounded-2xl px-4 py-3 text-sm leading-6',
                  turn.role === 'user'
                    ? 'ml-auto bg-accent/15 text-text-primary'
                    : 'mr-auto bg-elevated text-text-primary',
                ].join(' ')}
              >
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">
                  {turn.role === 'user' ? 'You' : 'Model'}
                </div>
                <div className="whitespace-pre-wrap">{turn.content}</div>
              </div>
            ))}

            {streaming ? (
              <div className="mr-auto max-w-3xl rounded-2xl bg-elevated px-4 py-3 text-sm leading-6 text-text-primary">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">
                  Model
                </div>
                <div className="whitespace-pre-wrap">{streaming}</div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border/80 px-4 py-4 sm:px-6">
            {error ? (
              <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="rounded-2xl border border-border bg-elevated/60 p-2 shadow-sm">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void runPrompt();
                  }
                }}
                rows={3}
                placeholder="Start typing a prompt to see what the model can do."
                className="w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-1">
                <div className="flex flex-wrap gap-2">
                  {webSearch ? (
                    <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
                      Grounding with web search
                    </span>
                  ) : null}
                  {structuredOutputs ? (
                    <span className="rounded-full bg-elevated px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                      Structured outputs
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {busy ? (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary"
                    >
                      <Square className="h-3.5 w-3.5" aria-hidden />
                      Stop
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || !prompt.trim()}
                    onClick={() => void runPrompt()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
                    Run
                    <span className="hidden text-[10px] opacity-80 sm:inline">Ctrl+Enter</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="overflow-y-auto bg-surface/60 px-4 py-5 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Run settings</p>

          <div className="mt-4 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Model</label>
              {modelsLoading ? (
                <p className="text-xs text-text-muted">Loading models...</p>
              ) : models.length === 0 ? (
                <p className="text-xs text-text-muted">
                  No models yet.{' '}
                  <Link href="/settings/keys" className="text-accent hover:underline">
                    Add a provider key
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-2">
                  <select
                    value={provider}
                    onChange={(e) => {
                      const next = e.target.value;
                      setProvider(next);
                      const first = models.find((row) => row.provider === next);
                      if (first) setModel(first.model);
                    }}
                    className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
                  >
                    {providers.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
                  >
                    {modelOptions.map((row) => (
                      <option key={`${row.provider}:${row.model}`} value={row.model}>
                        {row.label || row.model}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">System instructions</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="w-full resize-y rounded-xl border border-border bg-elevated px-3 py-2 text-sm leading-6 text-text-primary outline-none"
                placeholder="Optional tone and style instructions for the model"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-medium text-text-secondary">Temperature</label>
                <span className="text-xs tabular-nums text-text-muted">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full accent-[var(--color-accent)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">Thinking level</label>
              <select
                value={thinkingLevel}
                onChange={(e) => setThinkingLevel(e.target.value as PlaygroundThinkingLevel)}
                className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-sm text-text-primary"
              >
                {THINKING_LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-text-secondary">Tools</p>
              <div className="space-y-3 rounded-2xl border border-border bg-elevated/50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">Grounding with web search</p>
                    <p className="text-xs text-text-muted">Prefer current facts when needed</p>
                  </div>
                  <ToggleSwitch checked={webSearch} onChange={setWebSearch} label="Web search" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">Code execution</p>
                    <p className="text-xs text-text-muted">Prefer runnable examples</p>
                  </div>
                  <ToggleSwitch
                    checked={codeExecution}
                    onChange={setCodeExecution}
                    label="Code execution"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-primary">Structured outputs</p>
                    <p className="text-xs text-text-muted">Force JSON object replies</p>
                  </div>
                  <ToggleSwitch
                    checked={structuredOutputs}
                    onChange={setStructuredOutputs}
                    label="Structured outputs"
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
