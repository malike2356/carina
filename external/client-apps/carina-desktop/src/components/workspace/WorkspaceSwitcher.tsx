import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { $activeWorkspace, $workspaces } from '../../store/carina.js';
import { createWorkspace, switchWorkspace } from '../../lib/gateway-client.js';
import { listSessions } from '../../lib/gateway-client.js';
import { $sessions } from '../../store/session.js';

const COLORS = ['#6366f1', '#22c55e', '#f97316', '#ec4899', '#06b6d4'];

interface Props {
  compact?: boolean;
  onSwitched?: () => void;
}

export default function WorkspaceSwitcher({ compact, onSwitched }: Props) {
  const workspaces = useStore($workspaces);
  const active = useStore($activeWorkspace);
  const sessions = useStore($sessions);
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  async function handleSwitch(id: string) {
    if (active?.id === id) {
      setOpen(false);
      return;
    }
    if (sessions.length > 0) {
      const ok = window.confirm('Switch workspace? Current sessions will remain available after reload.');
      if (!ok) return;
    }
    await switchWorkspace(id);
    const nextSessions = await listSessions();
    $sessions.set(nextSessions);
    onSwitched?.();
    setOpen(false);
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createWorkspace(trimmed, color, trimmed.slice(0, 1).toUpperCase());
    setName('');
    setModalOpen(false);
    onSwitched?.();
  }

  if (compact) {
    return (
      <button
        type="button"
        title={active?.name ?? 'Workspace'}
        onClick={() => setOpen((value) => !value)}
        className="h-8 w-8 rounded-lg text-xs font-semibold text-white"
        style={{ backgroundColor: active?.color ?? '#6366f1' }}
      >
        {active?.icon ?? 'C'}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800"
      >
        <span
          className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-semibold text-white"
          style={{ backgroundColor: active?.color ?? '#6366f1' }}
        >
          {active?.icon ?? 'C'}
        </span>
        <span className="flex-1 text-left text-sm font-medium text-zinc-100 truncate">{active?.name ?? 'Workspace'}</span>
        <span className="text-zinc-500 text-xs">v</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl p-2 space-y-1">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => void handleSwitch(workspace.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 text-left"
            >
              <span className="h-6 w-6 rounded text-xs flex items-center justify-center text-white" style={{ backgroundColor: workspace.color }}>
                {workspace.icon}
              </span>
              <span className="flex-1 text-sm text-zinc-200 truncate">{workspace.name}</span>
              <span className="text-[10px] text-zinc-600">{workspace.sessionCount}</span>
              {active?.id === workspace.id && <span className="text-green-400 text-xs">ok</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setModalOpen(true);
              setOpen(false);
            }}
            className="w-full text-xs text-indigo-300 px-2 py-1.5 rounded hover:bg-zinc-800"
          >
            New workspace
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-100">Create workspace</h3>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Workspace name"
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded"
            />
            <div className="flex gap-2">
              {COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColor(item)}
                  className={`h-6 w-6 rounded-full border ${color === item ? 'border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: item }}
                />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="text-xs px-3 py-1.5 text-zinc-400">Cancel</button>
              <button type="button" onClick={() => void handleCreate()} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
