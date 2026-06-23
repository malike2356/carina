import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { useNavigate } from 'react-router-dom';
import {
  $commitments,
  $learningMetrics,
  $orchestrationAgents,
  $systemHealth,
} from '../../store/carina.js';
import { cancelCommitment, completeCommitment, runBenchmark } from '../../lib/gateway-client.js';
import { ROUTES } from '../../lib/router-paths.js';

const TABS = ['Orchestration', 'Commitments', 'Benchmarks', 'Learning', 'System'] as const;

export default function OperatorPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Commitments');
  const commitments = useStore($commitments);
  const learning = useStore($learningMetrics);
  const health = useStore($systemHealth);
  const agents = useStore($orchestrationAgents);
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-100">Operator Panel</h1>
        <span className="text-xs text-zinc-500">Power-user tools and metrics</span>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`text-xs px-3 py-1.5 rounded ${tab === item ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-900'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'Orchestration' && (
        <section className="space-y-3">
          <p className="text-sm text-zinc-400">Active parallel agent runs</p>
          {agents.length === 0 ? (
            <p className="text-xs text-zinc-600">No active orchestration graphs</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {agents.map((agent) => (
                <div key={agent.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-zinc-100">{agent.name}</p>
                    <span className="text-xs text-zinc-500">{agent.status}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{agent.task}</p>
                  <p className="text-[10px] text-zinc-600 mt-2">{new Date(agent.startedAt).toLocaleString()}</p>
                  {agent.parentSessionId && (
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.chat)}
                      className="mt-2 text-xs text-indigo-300"
                    >
                      Open parent session
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'Commitments' && (
        <section className="space-y-2">
          {commitments.length === 0 && <p className="text-sm text-zinc-500">No active commitments</p>}
          {commitments.map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm text-zinc-100">{item.title}</p>
                <p className="text-xs text-zinc-500 mt-1">{item.status} | due {new Date(item.dueAt).toLocaleString()}</p>
                {item.sourceSummary && <p className="text-xs text-zinc-600 mt-1">{item.sourceSummary}</p>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void completeCommitment(item.id)} className="text-xs border border-zinc-700 rounded px-2 py-1">Done</button>
                <button type="button" onClick={() => void cancelCommitment(item.id)} className="text-xs border border-red-800 text-red-300 rounded px-2 py-1">Cancel</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'Benchmarks' && (
        <section className="space-y-3">
          <p className="text-sm text-zinc-400">Benchmark history and model breakdown</p>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard label="Task success rate" value="n/a" />
            <MetricCard label="Avg response time" value="n/a" />
            <MetricCard label="Tool call efficiency" value="n/a" />
          </div>
          <button
            type="button"
            onClick={() => void runBenchmark().catch(() => window.alert('Benchmark runner not configured'))}
            className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5"
          >
            Run benchmark
          </button>
        </section>
      )}

      {tab === 'Learning' && (
        <section className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <MetricCard label="Skill success rate" value={`${Math.round((learning?.skillSuccessRate ?? 0) * 100)}%`} />
            <MetricCard label="Memories extracted (weekly)" value={String(learning?.memoriesExtractedWeekly ?? 0)} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-600 mb-2">Learned preferences</p>
            {(learning?.preferences ?? []).length === 0 && <p className="text-xs text-zinc-600">No preferences recorded yet</p>}
            {(learning?.preferences ?? []).map((pref) => (
              <div key={`${pref.learnedAt}-${pref.preference}`} className="text-xs text-zinc-300 border-b border-zinc-800 py-2">
                {pref.preference}
                <span className="text-zinc-600 ml-2">{new Date(pref.learnedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'System' && (
        <section className="grid gap-3 md:grid-cols-2">
          <MetricCard label="Gateway" value={health?.gatewayStatus ?? 'unknown'} />
          <MetricCard label="Uptime" value={`${Math.floor((health?.uptimeSeconds ?? 0) / 60)} min`} />
          <MetricCard label="Heap used" value={`${health?.heapUsedMb ?? 0} MB`} />
          <MetricCard label="Queue depth" value={String(health?.queueDepth ?? 0)} />
          <MetricCard label="Suspended" value={health?.suspended ? 'yes' : 'no'} />
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="text-lg font-semibold text-zinc-100 mt-1">{value}</p>
    </div>
  );
}
