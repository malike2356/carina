import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { SessionInfo } from '../transport/json-rpc.js';
import { colors } from '../theme/colors.js';

interface Props {
  sessions: SessionInfo[];
  currentSessionId?: string;
  onSelect: (session: SessionInfo) => void;
  onCreate: () => void;
  onClose: () => void;
}

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function SessionSwitcher({
  sessions,
  currentSessionId,
  onSelect,
  onCreate,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [focusSearch, setFocusSearch] = useState(true);

  const filtered = useMemo(() =>
    sessions.filter((s) =>
      fuzzyMatch(query, s.name)
      || fuzzyMatch(query, s.updatedAt ?? '')
      || fuzzyMatch(query, s.lastPreview ?? ''),
    ),
  [sessions, query]);

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }
    if (input === 'n') { onCreate(); return; }
    if (input === '/' || key.tab) { setFocusSearch(true); return; }
    if (focusSearch) return;
    if (input === 'j' || key.downArrow) {
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    }
    if (input === 'k' || key.upArrow) {
      setCursor((c) => Math.max(c - 1, 0));
    }
    if (key.return && filtered[cursor]) {
      onSelect(filtered[cursor]);
    }
  });

  return (
    <Box
      flexDirection="column"
      position="absolute"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={colors.primary}>Sessions</Text>
      <Text dimColor>Search, j/k navigate, Enter switch, n new, Esc close</Text>
      <Box marginY={1}>
        <Text color={colors.accent}>{'> '}</Text>
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Filter sessions..."
          onSubmit={() => setFocusSearch(false)}
        />
      </Box>
      {filtered.map((s, idx) => {
        const selected = idx === cursor;
        const current = s.id === currentSessionId;
        return (
          <Box key={s.id} flexDirection="column" marginBottom={0}>
            <Text>
              {selected ? '>' : ' '}
              {current ? <Text bold>{s.name}</Text> : s.name}
              {' '}
              <Text dimColor>
                {s.updatedAt ?? ''} | {s.messageCount} msgs
              </Text>
            </Text>
            {s.lastPreview && (
              <Text dimColor wrap="truncate">  {s.lastPreview}</Text>
            )}
          </Box>
        );
      })}
      {filtered.length === 0 && <Text dimColor>No matching sessions.</Text>}
    </Box>
  );
}
