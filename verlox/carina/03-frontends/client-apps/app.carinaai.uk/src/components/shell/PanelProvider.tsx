'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

interface ContextPin {
  noteId: string;
  label: string;
  content: string;
}

interface ContextPinsContextValue {
  pinnedNoteIds: Set<string>;
  onPinToggle: (noteId: string, label: string, content: string) => void;
}

const ContextPinsContext = createContext<ContextPinsContextValue | null>(null);

export function useContextPins() {
  return useContext(ContextPinsContext);
}

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [contextPins, setContextPins] = useState<ContextPin[]>([]);
  const params = useParams<{ sessionId?: string }>();
  const sessionId = params?.sessionId ?? null;

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

  const value = useMemo(
    () => ({
      pinnedNoteIds: new Set(contextPins.map((pin) => pin.noteId)),
      onPinToggle: toggleContextPin,
    }),
    [contextPins, toggleContextPin],
  );

  return <ContextPinsContext.Provider value={value}>{children}</ContextPinsContext.Provider>;
}
