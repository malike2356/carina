import fs from 'fs/promises';
import path from 'path';
import type { Skill } from '../types/index.js';
import type { SkillStatus } from './curator.js';
import { listCuratedSkills, pruneStaleSkills } from './curator.js';

export interface CuratorReviewReport {
  generatedAt: string;
  summary: {
    active: number;
    archived: number;
    pruned: number;
    staleCandidates: number;
  };
  staleCandidates: Array<{
    name: string;
    usageCount: number;
    lastTouch: string;
  }>;
  recentArchived: Array<{ name: string; description: string }>;
  recommendations: string[];
}

export function buildCuratorReviewReportFromLists(input: {
  active: Array<Skill & { status: SkillStatus }>;
  archived: Array<Skill & { status: SkillStatus }>;
  pruned: Array<Skill & { status: SkillStatus }>;
  staleCandidates: string[];
  maxAgeDays?: number;
  minUsage?: number;
}): CuratorReviewReport {
  const maxAgeDays = input.maxAgeDays ?? 90;
  const minUsage = input.minUsage ?? 0;
  const staleSet = new Set(input.staleCandidates);
  const staleDetails = input.active
    .filter((s) => staleSet.has(s.name))
    .map((s) => ({
      name: s.name,
      usageCount: s.usageCount,
      lastTouch: s.createdAt.toISOString(),
    }));

  const recommendations: string[] = [];
  if (staleDetails.length > 0) {
    recommendations.push(
      `${staleDetails.length} active skill(s) match stale criteria (usage<=${minUsage}, age>${maxAgeDays}d). Run: carina curator prune --dry-run`,
    );
  }
  if (input.archived.length > 5) {
    recommendations.push(`${input.archived.length} archived skills; review restore vs prune.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      active: input.active.length,
      archived: input.archived.length,
      pruned: input.pruned.length,
      staleCandidates: staleDetails.length,
    },
    staleCandidates: staleDetails,
    recentArchived: input.archived.slice(0, 10).map((s) => ({
      name: s.name,
      description: s.description.slice(0, 120),
    })),
    recommendations,
  };
}

export async function buildCuratorReviewReport(options: {
  maxAgeDays?: number;
  minUsage?: number;
} = {}): Promise<CuratorReviewReport> {
  const maxAgeDays = options.maxAgeDays ?? Number(process.env.CARINA_SKILL_CURATOR_MAX_AGE_DAYS ?? '90');
  const minUsage = options.minUsage ?? Number(process.env.CARINA_SKILL_CURATOR_MIN_USAGE ?? '0');

  const [active, archived, pruned, stale] = await Promise.all([
    listCuratedSkills('active'),
    listCuratedSkills('archived'),
    listCuratedSkills('pruned'),
    pruneStaleSkills({ dryRun: true, maxAgeDays, minUsage }),
  ]);

  return buildCuratorReviewReportFromLists({
    active,
    archived,
    pruned,
    staleCandidates: stale.candidates,
    maxAgeDays,
    minUsage,
  });
}

export async function writeCuratorReviewReport(
  reportsDir: string,
  report: CuratorReviewReport,
): Promise<{ latestPath: string; datedPath: string }> {
  await fs.mkdir(reportsDir, { recursive: true });
  const dated = `report-${report.generatedAt.slice(0, 10)}.json`;
  const datedPath = path.join(reportsDir, dated);
  const latestPath = path.join(reportsDir, 'latest.json');
  const body = JSON.stringify(report, null, 2);
  await fs.writeFile(datedPath, body, 'utf8');
  await fs.writeFile(latestPath, body, 'utf8');
  return { latestPath, datedPath };
}
