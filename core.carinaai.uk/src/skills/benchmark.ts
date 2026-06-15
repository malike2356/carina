import { pool } from '../memory/db.js';
import { saveMemory } from '../memory/store.js';

export interface BenchmarkSkillEntry {
  name: string;
  usageCount: number;
  successRate: number;
  description: string;
}

export interface CompoundingReport {
  topSkills: BenchmarkSkillEntry[];
  summary: string;
}

export async function runCompoundingBenchmark(sessionId = 'benchmark'): Promise<CompoundingReport> {
  const result = await pool.query(
    `SELECT name, description, usage_count, success_count, failure_count
     FROM skill_documents
     WHERE COALESCE(status, 'active') = 'active'
     ORDER BY usage_count DESC
     LIMIT 5`,
  );

  const topSkills: BenchmarkSkillEntry[] = result.rows.map((row) => {
    const usageCount = Number(row.usage_count ?? 0);
    const successCount = Number(row.success_count ?? 0);
    const failureCount = Number(row.failure_count ?? 0);
    const total = successCount + failureCount;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
    return { name: String(row.name), description: String(row.description), usageCount, successRate };
  });

  const avgSuccessRate = topSkills.length > 0
    ? Math.round(topSkills.reduce((s, sk) => s + sk.successRate, 0) / topSkills.length)
    : 0;

  const summary = `Carina compounding report: ${topSkills.length} most-used skills, avg ${avgSuccessRate}% success rate.`;

  await saveMemory(sessionId, 'assistant', `benchmark-${new Date().toISOString().slice(0, 10)}: ${summary}`).catch(() => void 0);

  return { topSkills, summary };
}
