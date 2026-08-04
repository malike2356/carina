import { count, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  byokKeys,
  scheduledTasks,
  userMemories,
  workspaceSkills,
} from '@/db/schema';
import { listSessions } from '@/lib/chat-sessions';
import { requireWorkspace } from '@/lib/session';

export interface LauncherSession {
  id: string;
  title: string;
  lastMessageAt: Date | string | null;
}

export interface LauncherData {
  userName: string;
  userEmail: string;
  sessions: LauncherSession[];
  totalSessions: number;
  latestSessionId: string | null;
  memoryCount: number;
  skillCount: number;
  keyCount: number;
  taskCount: number;
  scoutPaired: boolean;
  version: string;
  activeSkillPacks: string;
}

async function loadOptionalLauncherValue<T>(
  label: string,
  loader: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    console.warn(
      `Launcher optional data load failed for ${label}:`,
      error instanceof Error ? error.message : error,
    );
    return fallback;
  }
}

function firstCount(rows: { n: number }[]): number {
  return rows[0]?.n ?? 0;
}

export async function loadLauncherData(userId: string, userName: string, userEmail: string): Promise<LauncherData> {
  const workspace = await requireWorkspace(userId);
  const wid = workspace.id;

  const [sessions, memoriesRes, skillsRes, keysRes, tasksRes, scoutKeys] = await Promise.all([
    loadOptionalLauncherValue('sessions', () => listSessions(wid, 50), []),
    loadOptionalLauncherValue(
      'memories',
      () => db
        .select({ n: count() })
        .from(userMemories)
        .where(and(eq(userMemories.workspaceId, wid), eq(userMemories.enabled, true))),
      [],
    ),
    loadOptionalLauncherValue(
      'skills',
      () => db
        .select({ n: count() })
        .from(workspaceSkills)
        .where(and(eq(workspaceSkills.workspaceId, wid), eq(workspaceSkills.enabled, true))),
      [],
    ),
    loadOptionalLauncherValue(
      'keys',
      () => db.select({ n: count() }).from(byokKeys).where(eq(byokKeys.workspaceId, wid)),
      [],
    ),
    loadOptionalLauncherValue(
      'tasks',
      () => db.select({ n: count() }).from(scheduledTasks).where(eq(scheduledTasks.workspaceId, wid)),
      [],
    ),
    loadOptionalLauncherValue(
      'scout keys',
      () => db.select({ provider: byokKeys.provider }).from(byokKeys).where(eq(byokKeys.workspaceId, wid)),
      [],
    ),
  ]);

  const recent = sessions.slice(0, 6).map((s) => ({
    id: s.id,
    title: s.title,
    lastMessageAt: s.lastMessageAt,
  }));

  return {
    userName,
    userEmail,
    sessions: recent,
    totalSessions: sessions.length,
    latestSessionId: sessions[0]?.id ?? null,
    memoryCount: firstCount(memoriesRes),
    skillCount: firstCount(skillsRes),
    keyCount: firstCount(keysRes),
    taskCount: firstCount(tasksRes),
    scoutPaired: scoutKeys.some((k) => k.provider === 'labyrinth-scout'),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
    activeSkillPacks: workspace.activeSkillPacks,
  };
}

export function findActiveSessionId(
  sessions: LauncherSession[],
  maxIdleMs = 30 * 60 * 1000,
): string | null {
  const latest = sessions[0];
  if (!latest?.lastMessageAt) return null;
  const ts = new Date(latest.lastMessageAt).getTime();
  if (Number.isNaN(ts) || Date.now() - ts > maxIdleMs) return null;
  return latest.id;
}
