import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { LauncherHeader } from './LauncherHeader.js';
import { LauncherFooter } from './LauncherFooter.js';
import { StatusColumn } from './StatusColumn.js';
import { QuickActionsColumn } from './QuickActionsColumn.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';
import { loadTuiLauncherData } from './launcher-data.js';

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
  const [command, setCommand] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [status, setStatus] = useState<StatusData>({
    model:    'loading...',
    memory:   'loading...',
    scout:    'loading...',
    channels: 'loading...',
    skills:   'loading...',
    latency:  'loading...',
    sessions: 'loading...',
    uptime:   'loading...',
  });
  const [projects, setProjects] = useState<RecentProject[]>([]);

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

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) { exit(); return; }
    if (key.upArrow)   { setSelectedIdx(i => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setSelectedIdx(i => Math.min(6, i + 1)); return; }
    if (key.return) {
      const cmd = command.trim().toLowerCase() || input;
      if (cmd === 'q' || cmd === 'quit' || cmd === 'exit') { exit(); return; }
      if (cmd === 'c' || cmd === 'chat' || cmd === '') { exit(); onLaunchChat(); return; }
      if (cmd === 'n') { exit(); onLaunchChat(); return; }
      setCommand('');
      return;
    }
    if (key.backspace || key.delete) { setCommand(c => c.slice(0, -1)); return; }
    if (!key.ctrl && !key.meta && input && input.length === 1) {
      if (input === 'q') { exit(); return; }
      if (input === 'c') { exit(); onLaunchChat(); return; }
      setCommand(c => c + input);
    }
  });

  if (columns < 80) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>CARINA LAUNCHER</Text>
        <Text color="gray">Terminal too narrow (need 80+ columns).</Text>
        <Box marginTop={1} flexDirection="column">
          <Text><Text color="cyan">[c]</Text> Start chat</Text>
          <Text><Text color="cyan">[q]</Text> Quit</Text>
        </Box>
      </Box>
    );
  }

  const leftWidth = Math.floor(columns * 0.35);
  const rightWidth = columns - leftWidth - 3;

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <LauncherHeader width={columns} version={version} />
      <Box flexDirection="row" flexGrow={1}>
        <StatusColumn width={leftWidth} status={status} />
        <Box borderStyle="single" borderColor="gray" borderLeft={true} borderRight={false} borderTop={false} borderBottom={false} />
        <QuickActionsColumn width={rightWidth} projects={projects} selectedIdx={selectedIdx} />
      </Box>
      <LauncherFooter width={columns} command={command} />
    </Box>
  );
}
