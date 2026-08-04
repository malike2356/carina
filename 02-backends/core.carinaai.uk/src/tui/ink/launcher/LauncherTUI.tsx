import React, { useState, useEffect, useMemo } from 'react';
import { Box, useApp, useInput } from 'ink';
import { LauncherHeader } from './LauncherHeader.js';
import { LauncherFooter } from './LauncherFooter.js';
import { StatusColumn } from './StatusColumn.js';
import { QuickActionsColumn } from './QuickActionsColumn.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { loadTuiLauncherData } from './launcher-data.js';
import { computeResponsiveFrame } from '../../responsive-frame.js';

interface Props {
  version: string;
  onLaunchChat: () => void;
}

interface StatusData {
  model: string;
  memory: string;
  scout: string;
  channels: string;
  skills: string;
  latency: string;
  sessions: string;
  uptime: string;
}

interface RecentProject {
  id: string;
  name: string;
  lastActivityAgo: string;
}

export function LauncherTUI({ version, onLaunchChat }: Props) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();
  const frame = useMemo(() => computeResponsiveFrame(columns, rows), [columns, rows]);
  const [command, setCommand] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [status, setStatus] = useState<StatusData>({
    model: 'loading...',
    memory: 'loading...',
    scout: 'loading...',
    channels: 'loading...',
    skills: 'loading...',
    latency: 'loading...',
    sessions: 'loading...',
    uptime: 'loading...',
  });
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const maxActionIndex = frame.mode === 'compact' ? 3 : 6;

  useEffect(() => {
    let cancelled = false;
    void loadTuiLauncherData(true).then((data) => {
      if (cancelled) return;
      setStatus(data.status);
      setProjects(data.projects);
    }).catch(() => {
      if (cancelled) return;
      setStatus((prev) => ({ ...prev, model: 'unavailable' }));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSelectedIdx((index) => Math.min(index, maxActionIndex));
  }, [maxActionIndex]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) { exit(); return; }
    if (key.upArrow) { setSelectedIdx((index) => Math.max(0, index - 1)); return; }
    if (key.downArrow) { setSelectedIdx((index) => Math.min(maxActionIndex, index + 1)); return; }
    if (key.return) {
      const selected = ['c', 'o', 'm', 's', 'k', '/', '?'][selectedIdx] ?? 'c';
      const cmd = command.trim().toLowerCase() || selected;
      if (cmd === 'q' || cmd === 'quit' || cmd === 'exit') { exit(); return; }
      if (cmd === 'c' || cmd === 'chat' || cmd === 'o' || cmd === '') { exit(); onLaunchChat(); return; }
      if (cmd === 'n') { exit(); onLaunchChat(); return; }
      setCommand('');
      return;
    }
    if (key.backspace || key.delete) { setCommand((value) => value.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta && input && input.length === 1) {
      if (input === 'q') { exit(); return; }
      if (input === 'c') { exit(); onLaunchChat(); return; }
      setCommand((value) => value + input);
    }
  });

  return (
    <Box flexDirection="column" width={frame.columns} height={frame.rows} overflow="hidden">
      <LauncherHeader frame={frame} version={version} />
      <Box flexDirection="column" flexGrow={1} height={frame.bodyHeight} overflow="hidden">
        {frame.twoColumn ? (
          <Box flexDirection="row" flexGrow={1} height={frame.bodyHeight}>
            <StatusColumn frame={frame} status={status} />
            <Box
              borderStyle="single"
              borderColor="gray"
              borderLeft
              borderRight={false}
              borderTop={false}
              borderBottom={false}
            />
            <QuickActionsColumn frame={frame} projects={projects} selectedIdx={selectedIdx} />
          </Box>
        ) : (
          <Box flexDirection="column" flexGrow={1} height={frame.bodyHeight} overflow="hidden">
            <StatusColumn frame={frame} status={status} />
            <QuickActionsColumn frame={frame} projects={projects} selectedIdx={selectedIdx} />
          </Box>
        )}
      </Box>
      <LauncherFooter frame={frame} command={command} />
    </Box>
  );
}
