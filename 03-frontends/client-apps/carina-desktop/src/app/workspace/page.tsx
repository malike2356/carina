import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AgentsPage from '../agents/page.js';
import ArtifactsPage from '../artifacts/page.js';
import SessionsPage from '../sessions/page.js';
import SkillsPage from '../skills/page.js';

type WorkspaceTab = 'sessions' | 'agents' | 'artifacts' | 'skills';

const TAB_ORDER: WorkspaceTab[] = ['sessions', 'agents', 'artifacts', 'skills'];

const TAB_LABELS: Record<WorkspaceTab, string> = {
  sessions: 'Sessions',
  agents: 'Agents',
  artifacts: 'Artifacts',
  skills: 'Skills',
};

function isWorkspaceTab(value: string | null): value is WorkspaceTab {
  return value === 'sessions' || value === 'agents' || value === 'artifacts' || value === 'skills';
}

export default function WorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [manualTab, setManualTab] = useState<WorkspaceTab | null>(null);

  const activeTab = useMemo(() => {
    const fromUrl = searchParams.get('tab');
    if (isWorkspaceTab(fromUrl)) return fromUrl;
    return manualTab ?? 'sessions';
  }, [manualTab, searchParams]);

  function setTab(tab: WorkspaceTab) {
    setManualTab(tab);
    setSearchParams({ tab });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Workspace</h1>
        <p className="mt-1 text-xs text-zinc-500">Everything that changes the workspace, grouped in one place.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TAB_ORDER.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTab(tab)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                activeTab === tab
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-200'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'sessions' && <SessionsPage />}
        {activeTab === 'agents' && <AgentsPage />}
        {activeTab === 'artifacts' && <ArtifactsPage />}
        {activeTab === 'skills' && <SkillsPage />}
      </div>
    </div>
  );
}
