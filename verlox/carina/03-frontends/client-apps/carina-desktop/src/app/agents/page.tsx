import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cancelAgent, getAgent, getAgents, type AgentRecord } from '../../lib/gateway-client.js';
import { ROUTES } from '../../lib/router-paths.js';

function statusBadge(status: AgentRecord['status']): string {
  if (status === 'running') return 'text-green-400';
  if (status === 'failed') return 'text-red-400';
  return 'text-zinc-500';
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentRecord | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const rows = await getAgents();
      if (!active) return;
      setAgents(rows.slice(0, 50));
      if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    };
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void getAgent(selectedId).then(setDetail);
  }, [selectedId, agents]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-72 border-r border-zinc-800 overflow-y-auto p-3 space-y-2">
        <h1 className="text-sm font-semibold text-zinc-100 px-1">Agents</h1>
        {agents.length === 0 && (
          <p className="text-xs text-zinc-500 px-1">No subagents yet. Spawn one from chat with a task.</p>
        )}
        {agents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setSelectedId(agent.id)}
            className={`w-full rounded-lg border px-3 py-2 text-left ${
              selectedId === agent.id ? 'border-indigo-500 bg-zinc-800' : 'border-zinc-800 hover:bg-zinc-900'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-zinc-100 truncate">{agent.name}</span>
              <span className={`text-xs ${statusBadge(agent.status)}`}>{agent.status}</span>
            </div>
            {agent.task && <p className="text-xs text-zinc-500 truncate mt-1">{agent.task}</p>}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!detail ? (
          <p className="text-sm text-zinc-500">Select an agent to inspect output.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-medium text-zinc-100">{detail.name}</h2>
              <span className={`text-xs ${statusBadge(detail.status)}`}>{detail.status}</span>
              {detail.status === 'running' && (
                <button
                  type="button"
                  onClick={() => void cancelAgent(detail.id)}
                  className="text-xs text-red-400 border border-red-800 rounded px-2 py-0.5"
                >
                  Cancel
                </button>
              )}
            </div>
            {detail.parentSessionId && (
              <Link to={ROUTES.chat} className="text-xs text-indigo-400 hover:underline">
                Open parent session
              </Link>
            )}
            <div className="text-xs text-zinc-500">
              Started: {detail.startedAt ? new Date(detail.startedAt).toLocaleString() : 'n/a'}
              {detail.endedAt ? ` | Ended: ${new Date(detail.endedAt).toLocaleString()}` : ''}
            </div>
            <pre className="rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
              {detail.output || 'No output captured yet.'}
            </pre>
            {detail.toolCalls && detail.toolCalls.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-2">Tool calls</h3>
                <ul className="space-y-1 text-xs text-zinc-400">
                  {detail.toolCalls.map((tool) => (
                    <li key={`${tool.name}-${tool.status}`}>{tool.name} ({tool.status})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
