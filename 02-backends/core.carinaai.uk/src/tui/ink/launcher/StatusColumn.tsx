import React from 'react';
import { Box, Text } from 'ink';
import type { ResponsiveFrame } from '../../responsive-frame.js';
import { truncateLabel } from '../../responsive-frame.js';

interface StatusData {
  model?: string;
  memory?: string;
  scout?: string;
  channels?: string;
  skills?: string;
  latency?: string;
  sessions?: string;
  uptime?: string;
}

interface Props {
  frame: ResponsiveFrame;
  status: StatusData;
}

function SectionTitle({ children, width }: { children: string; width: number }) {
  return (
    <Box marginTop={1}>
      <Text color="cyan" bold>{truncateLabel(`--- ${children}`, width)}</Text>
    </Box>
  );
}

function StatusRow({
  label,
  value,
  maxValueLen,
  width,
}: {
  label: string;
  value: string;
  maxValueLen: number;
  width: number;
}) {
  const isErr = value.toLowerCase().includes('err') || value.toLowerCase().includes('offline');
  const labelText = truncateLabel(label, 12).padEnd(12);
  const valueText = truncateLabel(value, maxValueLen);
  const line = truncateLabel(`> ${labelText} ${valueText}`, Math.max(8, width - 5));
  return (
    <Box>
      <Text>{line}</Text>
      {width >= 28 && <Text color={isErr ? 'red' : 'cyan'}> [OK]</Text>}
    </Box>
  );
}

export function StatusColumn({ frame, status }: Props) {
  const width = frame.twoColumn ? frame.leftWidth : frame.contentWidth;
  const maxValueLen = frame.maxStatusValueLen;

  return (
    <Box flexDirection="column" width={width} paddingX={1} paddingY={1}>
      <SectionTitle width={width}>SYSTEM STATUS</SectionTitle>
      <Box marginTop={1} flexDirection="column">
        <StatusRow label="Memory" value={status.memory ?? 'loading...'} maxValueLen={maxValueLen} width={width} />
        <StatusRow label="Channels" value={status.channels ?? 'loading...'} maxValueLen={maxValueLen} width={width} />
        <StatusRow label="Models" value={status.model ?? 'loading...'} maxValueLen={maxValueLen} width={width} />
        {frame.mode !== 'compact' && (
          <StatusRow label="Skills" value={status.skills ?? 'loading...'} maxValueLen={maxValueLen} width={width} />
        )}
        <StatusRow label="Scout" value={status.scout ?? 'loading...'} maxValueLen={maxValueLen} width={width} />
        {frame.mode !== 'compact' && (
          <StatusRow label="Workspace" value="Environment ready" maxValueLen={maxValueLen} width={width} />
        )}
      </Box>

      {frame.showSystemHealth && (
        <>
          <SectionTitle width={width}>SYSTEM HEALTH</SectionTitle>
          <Box marginTop={1}>
            <Text color="gray">{'> '}</Text>
            <Text>{truncateLabel('All services operational', Math.max(8, width - 16))}</Text>
            {width >= 48 && <Text color="cyan"> [████]</Text>}
          </Box>
        </>
      )}

      {frame.showLastActivity && (
        <>
          <SectionTitle width={width}>LAST ACTIVITY</SectionTitle>
          <Box marginTop={1} flexDirection="column">
            <Text>{truncateLabel('> Scout Dashboard Redesign', width)}</Text>
            <Text color="gray">{truncateLabel('  Project: Scout  Mode: Design  Duration: 42m', width)}</Text>
          </Box>
        </>
      )}

      {frame.showActiveProjects && (
        <>
          <SectionTitle width={width}>ACTIVE PROJECTS</SectionTitle>
          <Box marginTop={1} flexDirection="column">
            <Text>{truncateLabel('> Propreneur    Workspace          2m ago', width)}</Text>
            <Text>{truncateLabel('> Carina        Core Agent         1h ago', width)}</Text>
            {frame.mode !== 'normal' && (
              <Text>{truncateLabel('> Scout         Dashboard Redesign 3d ago', width)}</Text>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
