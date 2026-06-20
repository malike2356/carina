import { useEffect, useMemo, useState } from 'react';
import {
  getSkills,
  installSkill,
  searchHubSkills,
  uninstallSkill,
  type HubSkill,
  type SkillPack,
} from '../../lib/gateway-client.js';

export default function SkillsPage() {
  const [tab, setTab] = useState<'installed' | 'hub'>('installed');
  const [installed, setInstalled] = useState<SkillPack[]>([]);
  const [hubQuery, setHubQuery] = useState('');
  const [hubResults, setHubResults] = useState<HubSkill[]>([]);
  const [selected, setSelected] = useState<SkillPack | HubSkill | null>(null);

  useEffect(() => {
    void getSkills().then(setInstalled);
  }, []);

  useEffect(() => {
    if (tab !== 'hub') return;
    const timer = window.setTimeout(() => {
      void searchHubSkills(hubQuery).then(setHubResults);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [hubQuery, tab]);

  const installedNames = useMemo(() => new Set(installed.map((s) => s.name)), [installed]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab('installed')}
            className={`px-3 py-1.5 text-sm rounded ${tab === 'installed' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}
          >
            Installed
          </button>
          <button
            type="button"
            onClick={() => setTab('hub')}
            className={`px-3 py-1.5 text-sm rounded ${tab === 'hub' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300'}`}
          >
            Browse Hub
          </button>
        </div>

        {tab === 'installed' ? (
          <div className="space-y-2">
            {installed.length === 0 && <p className="text-sm text-zinc-500">No skill packs installed.</p>}
            {installed.map((pack) => (
              <button
                key={pack.name}
                type="button"
                onClick={() => setSelected(pack)}
                className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-zinc-100">{pack.name}</h2>
                  <label className="text-xs text-zinc-400 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pack.enabled !== false}
                      onChange={(e) => {
                        e.stopPropagation();
                        setInstalled((rows) => rows.map((row) =>
                          row.name === pack.name ? { ...row, enabled: e.target.checked } : row,
                        ));
                      }}
                    />
                    Enabled
                  </label>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{pack.description ?? 'No description'}</p>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <input
              value={hubQuery}
              onChange={(e) => setHubQuery(e.target.value)}
              placeholder="Search Carina Hub"
              className="w-full mb-3 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg"
            />
            <div className="space-y-2">
              {hubResults.map((skill) => (
                <div key={skill.name} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-medium text-zinc-100">{skill.name}</h2>
                      <p className="text-xs text-zinc-500">{skill.description}</p>
                    </div>
                    <button
                      type="button"
                      disabled={installedNames.has(skill.name)}
                      onClick={() => void installSkill(skill.name).then(() => getSkills().then(setInstalled))}
                      className="text-xs bg-indigo-600 disabled:opacity-50 text-white rounded px-2 py-1"
                    >
                      Install
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <aside className="w-80 border-l border-zinc-800 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-zinc-100">{selected.name}</h2>
          <p className="text-xs text-zinc-500 mt-2">{selected.description ?? 'No description available.'}</p>
          {'enabled' in selected && (
            <button
              type="button"
              onClick={() => void uninstallSkill(selected.name).then(() => getSkills().then(setInstalled))}
              className="mt-4 text-xs text-red-400 border border-red-800 rounded px-2 py-1"
            >
              Uninstall
            </button>
          )}
        </aside>
      )}
    </div>
  );
}
