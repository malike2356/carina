'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MemoryPanel } from '@/components/panels/MemoryPanel';
import { NotesPanel } from '@/components/panels/NotesPanel';
import { Terminal } from '@/components/terminal/Terminal';
import { SkillsPanel } from '@/components/panels/SkillsPanel';

type PanelType = 'memory' | 'skills' | 'notes' | 'terminal' | null;
interface ContextPin {
  noteId: string;
  label: string;
  content: string;
}

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [contextPins, setContextPins] = useState<ContextPin[]>([]);
  const params = useParams<{ sessionId?: string }>();
  const sessionId = params?.sessionId ?? null;

  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as PanelType;
      setActivePanel((prev) => (prev === detail ? null : detail));
    }
    document.addEventListener('open-panel', handler);
    return () => document.removeEventListener('open-panel', handler);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setContextPins([]);
      return;
    }

    fetch(`/api/context-pins?sessionId=${encodeURIComponent(sessionId)}`)
      .then((response) => response.json())
      .then((data: { data?: Array<{ referenceId: string | null; label: string; content: string }> }) => {
        if (!data.data) return;
        setContextPins(
          data.data
            .filter((pin) => pin.referenceId)
            .map((pin) => ({
              noteId: pin.referenceId as string,
              label: pin.label,
              content: pin.content,
            })),
        );
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent('context-pins-changed', { detail: contextPins }));
  }, [contextPins]);

  useEffect(() => {
    function handler(event: Event) {
      const detail = (event as CustomEvent).detail as { id?: string; noteId?: string };
      const noteId = detail.noteId ?? detail.id;
      if (!noteId) return;
      setContextPins((prev) => prev.filter((pin) => pin.noteId !== noteId));
      if (sessionId) {
        void fetch(`/api/notes/${noteId}/pin`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      }
    }

    document.addEventListener('context-pin-remove', handler);
    return () => document.removeEventListener('context-pin-remove', handler);
  }, [sessionId]);

  const toggleContextPin = useCallback(
    (noteId: string, label: string, content: string) => {
      setContextPins((prev) => {
        const exists = prev.some((pin) => pin.noteId === noteId);
        return exists
          ? prev.filter((pin) => pin.noteId !== noteId)
          : [...prev, { noteId, label, content }];
      });

      if (!sessionId) return;
      const exists = contextPins.some((pin) => pin.noteId === noteId);
      void fetch(`/api/notes/${noteId}/pin`, {
        method: exists ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    },
    [contextPins, sessionId],
  );

  const pinnedNoteIds = new Set(contextPins.map((pin) => pin.noteId));

  return (
    <>
      {children}
      {activePanel === 'memory' && <MemoryPanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'skills' && <SkillsPanel onClose={() => setActivePanel(null)} />}
      {activePanel === 'notes' && (
        <NotesPanel
          onClose={() => setActivePanel(null)}
          activeSessionId={sessionId}
          pinnedNoteIds={pinnedNoteIds}
          onPinToggle={toggleContextPin}
        />
      )}
      {activePanel === 'terminal' && (
        <TerminalDrawer onClose={() => setActivePanel(null)} />
      )}
    </>
  );
}

function TerminalDrawer({ onClose }: { onClose: () => void }) {
  const [height, setHeight] = useState(380);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('carina-terminal-drawer-height');
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed) && parsed >= 240 && parsed <= window.innerHeight - 120) {
      setHeight(parsed);
    }
  }, []);

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (!dragging) return;
      const next = Math.max(240, Math.min(window.innerHeight - 96, window.innerHeight - event.clientY));
      setHeight(next);
      window.localStorage.setItem('carina-terminal-drawer-height', String(next));
    }

    function onUp() {
      setDragging(false);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-base"
      style={{ height }}
    >
      <div
        className="flex h-2 cursor-row-resize items-center justify-center border-b border-border bg-surface"
        onPointerDown={() => setDragging(true)}
        title="Drag to resize terminal"
      >
        <span className="h-1 w-14 rounded-full bg-border" />
      </div>
      <div className="h-[calc(100%-0.5rem)]">
        <Terminal mode="drawer" onClose={onClose} />
      </div>
    </div>
  );
}
