'use client';

import { useMemo } from 'react';
import {
  Brain,
  Cpu,
  MessageSquare,
  Shield,
  Sparkles,
  ListTodo,
} from 'lucide-react';
import RadialOrbitalTimeline, { type TimelineItem } from '@/components/ui/radial-orbital-timeline';

interface Props {
  memoryCount: number;
  skillCount: number;
  keyCount: number;
  totalSessions: number;
  taskCount: number;
}

function nodeStatus(active: boolean, partial = false): TimelineItem['status'] {
  if (active) return 'completed';
  if (partial) return 'in-progress';
  return 'pending';
}

function energyFrom(count: number, max: number): number {
  if (max <= 0) return count > 0 ? 100 : 15;
  return Math.min(100, Math.max(15, Math.round((count / max) * 100)));
}

export function LauncherOrbitalTimeline({
  memoryCount,
  skillCount,
  keyCount,
  totalSessions,
  taskCount,
}: Props) {
  const timelineData = useMemo<TimelineItem[]>(() => {
    const memoryEnergy = energyFrom(memoryCount, 50);
    const modelEnergy = keyCount > 0 ? Math.min(100, keyCount * 25) : 20;
    const skillEnergy = energyFrom(skillCount, 24);
    const channelEnergy = energyFrom(totalSessions, 10);
    const taskEnergy = energyFrom(taskCount, 5);

    return [
      {
        id: 1,
        title: 'Memory',
        date: 'Live',
        content:
          memoryCount > 0
            ? `${memoryCount} memor${memoryCount === 1 ? 'y' : 'ies'} synced across your workspace.`
            : 'No memories stored yet. Add context from Library or chat.',
        category: 'Memory',
        icon: Brain,
        relatedIds: [2, 4],
        status: nodeStatus(memoryCount > 0),
        energy: memoryEnergy,
      },
      {
        id: 2,
        title: 'Models',
        date: 'Live',
        content:
          keyCount > 0
            ? `${keyCount} API key${keyCount === 1 ? '' : 's'} configured and ready for inference.`
            : 'Add provider keys in Settings to unlock model routing.',
        category: 'Models',
        icon: Cpu,
        relatedIds: [1, 3],
        status: nodeStatus(keyCount > 0),
        energy: modelEnergy,
      },
      {
        id: 3,
        title: 'Skills',
        date: 'Live',
        content:
          skillCount > 0
            ? `${skillCount} skill pack${skillCount === 1 ? '' : 's'} loaded into the agent.`
            : 'Enable skill packs in Settings to extend agent capabilities.',
        category: 'Skills',
        icon: Sparkles,
        relatedIds: [2, 6],
        status: nodeStatus(skillCount > 0, skillCount > 0 && skillCount < 3),
        energy: skillEnergy,
      },
      {
        id: 4,
        title: 'Channels',
        date: 'Live',
        content:
          totalSessions > 0
            ? `${totalSessions} active conversation channel${totalSessions === 1 ? '' : 's'} in this workspace.`
            : 'Start a chat to open your first channel.',
        category: 'Channels',
        icon: MessageSquare,
        relatedIds: [1, 5],
        status: nodeStatus(totalSessions > 0),
        energy: channelEnergy,
      },
      {
        id: 5,
        title: 'Scout',
        date: 'Always on',
        content: 'Governance and workspace protection active. Scout monitors policy boundaries.',
        category: 'Security',
        icon: Shield,
        relatedIds: [4, 6],
        status: 'completed',
        energy: 100,
      },
      {
        id: 6,
        title: 'Tasks',
        date: 'Live',
        content:
          taskCount > 0
            ? `${taskCount} scheduled task${taskCount === 1 ? '' : 's'} queued in the workspace.`
            : 'No scheduled tasks. Create automations from Tasks.',
        category: 'Tasks',
        icon: ListTodo,
        relatedIds: [3, 5],
        status: nodeStatus(taskCount > 0),
        energy: taskEnergy,
      },
    ];
  }, [memoryCount, skillCount, keyCount, totalSessions, taskCount]);

  return (
    <div className="launcher-orbit-timeline w-full h-full min-h-0">
      <RadialOrbitalTimeline timelineData={timelineData} embedded />
    </div>
  );
}
