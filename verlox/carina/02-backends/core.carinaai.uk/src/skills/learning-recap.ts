import { listWorkshopDrafts, workshopReviewEnabled } from './workshop-store.js';
import {
  getLearningLoopMetrics,
  listAcceptedImprovements,
  listLearnedPreferences,
  listPendingCorrections,
  type LearningLoopMetrics,
} from './learning-ops.js';
import { listLearningEvents } from './learning-events.js';

export interface LearningRecapItem {
  at: string;
  label: string;
  detail?: string;
}

export interface LearningRecapSection {
  title: string;
  items: LearningRecapItem[];
}

export interface LearningRecap {
  generatedAt: string;
  days: number;
  metrics: LearningLoopMetrics;
  sections: LearningRecapSection[];
  hints: string[];
}

function withinDays(iso: string, days: number): boolean {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  return ts >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export async function buildLearningRecap(
  tenantId = '__operator__',
  options: { days?: number } = {},
): Promise<LearningRecap> {
  const days = Math.min(90, Math.max(1, options.days ?? 7));
  const metrics = await getLearningLoopMetrics(tenantId);
  const [improvements, preferences, pending, events] = await Promise.all([
    listAcceptedImprovements(tenantId, 100),
    listLearnedPreferences(tenantId, 50),
    listPendingCorrections(tenantId, 30),
    listLearningEvents({ tenantId, limit: 200 }),
  ]);

  const recentImprovements = improvements
    .filter((row) => withinDays(row.createdAt, days))
    .slice(0, 12)
    .map((row) => ({
      at: row.createdAt,
      label: row.skillName,
      detail: row.eventType.replace(/_/g, ' '),
    }));

  const recentPreferences = preferences
    .filter((row) => withinDays(row.learnedAt, days))
    .slice(0, 10)
    .map((row) => ({
      at: row.learnedAt,
      label: row.preference,
      detail: row.action,
    }));

  const taskOutcomes = events
    .filter((row) => row.eventType === 'task_outcome_saved' && withinDays(row.createdAt, days))
    .slice(0, 10)
    .map((row) => ({
      at: row.createdAt,
      label: String(row.inputSummary?.topic ?? 'task outcome'),
      detail: row.sessionId ? `session ${row.sessionId.slice(0, 8)}` : undefined,
    }));

  const sections: LearningRecapSection[] = [];

  if (recentImprovements.length > 0) {
    sections.push({ title: 'Skills created or refined', items: recentImprovements });
  }
  if (recentPreferences.length > 0) {
    sections.push({ title: 'Preferences learned', items: recentPreferences });
  }
  if (taskOutcomes.length > 0) {
    sections.push({ title: 'Work summaries indexed', items: taskOutcomes });
  }
  if (pending.length > 0) {
    sections.push({
      title: 'Pending review',
      items: pending.slice(0, 8).map((row) => ({
        at: row.updatedAt,
        label: row.skillName,
        detail: `${row.source}; uses=${row.usageCount}`,
      })),
    });
  }

  if (workshopReviewEnabled()) {
    const drafts = listWorkshopDrafts('pending').slice(0, 8);
    if (drafts.length > 0) {
      sections.push({
        title: 'Workshop drafts',
        items: drafts.map((draft) => ({
          at: draft.createdAt,
          label: draft.name,
          detail: draft.source,
        })),
      });
    }
  }

  const hints = [
    'Find prior work: carina memory sessions search "<topic>"',
    'In chat, ask Carina to use session-search for past threads',
    'Review loop health: carina learning status',
    'Rollback a skill: carina learning versions <name> then carina learning rollback <name> <version>',
  ];

  return {
    generatedAt: new Date().toISOString(),
    days,
    metrics,
    sections,
    hints,
  };
}

export function formatLearningRecap(recap: LearningRecap): string {
  const lines: string[] = [
    `Learning recap (last ${recap.days} days)`,
    `Auto skill capture: ${recap.metrics.autoSkillEnabled ? 'on' : 'off'}`,
    `Curator: ${recap.metrics.curatorEnabled ? 'on' : 'off'}`,
    `Events (24h): ${recap.metrics.eventsLast24h}; drafts pending: ${recap.metrics.draftsPending}`,
    '',
  ];

  if (recap.sections.length === 0) {
    lines.push('Nothing new to recap yet. Complex multi-tool tasks and corrections feed the loop.');
  } else {
    for (const section of recap.sections) {
      lines.push(section.title);
      for (const item of section.items) {
        const detail = item.detail ? ` (${item.detail})` : '';
        lines.push(`  ${item.at.slice(0, 10)}  ${item.label}${detail}`);
      }
      lines.push('');
    }
  }

  lines.push('Find prior work');
  for (const hint of recap.hints) {
    lines.push(`  ${hint}`);
  }

  return lines.join('\n');
}
