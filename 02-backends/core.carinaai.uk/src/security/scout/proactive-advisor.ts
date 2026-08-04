import { randomUUID } from 'crypto';
import { config } from '../../config/index.js';
import { reportScoutSignal } from '../scout-client.js';
import { buildTrustComplianceReport } from '../trust-compliance-report.js';
import { isScoutAgenticLayerEnabled } from './scout-agentic-guard.js';
import { fetchScoutEvents } from './scout-api-client.js';
import type { ProactiveRecommendation } from './types.js';

let cachedRecommendations: ProactiveRecommendation[] = [];
let lastRunAt: string | null = null;

export function getCachedProactiveRecommendations(): {
  generatedAt: string | null;
  recommendations: ProactiveRecommendation[];
} {
  return { generatedAt: lastRunAt, recommendations: [...cachedRecommendations] };
}

export function _resetProactiveAdvisorCache(): void {
  cachedRecommendations = [];
  lastRunAt = null;
}

function countByEventType(events: Awaited<ReturnType<typeof fetchScoutEvents>>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.event_type, (counts.get(event.event_type) ?? 0) + 1);
  }
  return counts;
}

export async function runProactiveAdvisor(): Promise<ProactiveRecommendation[]> {
  if (!isScoutAgenticLayerEnabled()) return [];

  const sinceMs = 30 * 24 * 60 * 60 * 1000;
  const events = (await fetchScoutEvents({ limit: 500 }))
    .filter((e) => new Date(e.created_at).getTime() >= Date.now() - sinceMs);

  const recommendations: ProactiveRecommendation[] = [];
  const now = new Date().toISOString();
  const typeCounts = countByEventType(events);

  const injectionCount = [...typeCounts.entries()]
    .filter(([type]) => /injection/.test(type))
    .reduce((sum, [, n]) => sum + n, 0);
  if (injectionCount >= 10) {
    recommendations.push({
      id: randomUUID(),
      priority: 1,
      riskScore: Math.min(95, 50 + injectionCount),
      category: 'threat_trend',
      title: 'Elevated prompt injection volume',
      detail: `${injectionCount} injection-related events in the last 30 days.`,
      suggestedAction: 'Review prompt guard tuning and enable egress filter if not active.',
      generatedAt: now,
    });
  }

  try {
    const trust = await buildTrustComplianceReport();
    for (const rec of trust.recommendations.slice(0, 3)) {
      recommendations.push({
        id: randomUUID(),
        priority: 2,
        riskScore: 55,
        category: 'compliance',
        title: 'Compliance posture gap',
        detail: rec,
        suggestedAction: 'Address compliance gap and sync evidence to Scout.',
        generatedAt: now,
      });
    }
  } catch {
    /* trust report optional */
  }

  if (!config.labyrinth.enabled) {
    recommendations.push({
      id: randomUUID(),
      priority: 1,
      riskScore: 80,
      category: 'scout_config',
      title: 'Scout integration disabled',
      detail: 'Carina is running without Scout governance and cross-agent correlation.',
      suggestedAction: 'Enable LABYRINTH_ENABLED and configure Scout API credentials.',
      generatedAt: now,
    });
  }

  if (process.env.SCOUT_ENFORCE_ALLOWLIST !== 'true') {
    recommendations.push({
      id: randomUUID(),
      priority: 3,
      riskScore: 45,
      category: 'egress',
      title: 'Egress allowlist not enforced',
      detail: 'SCOUT_ENFORCE_ALLOWLIST is not enabled; outbound tool calls use default policy only.',
      suggestedAction: 'Enable SCOUT_ENFORCE_ALLOWLIST=true for stricter egress control.',
      generatedAt: now,
    });
  }

  recommendations.sort((a, b) => a.priority - b.priority || b.riskScore - a.riskScore);
  cachedRecommendations = recommendations.slice(0, 20);
  lastRunAt = now;

  if (recommendations.length > 0) {
    await reportScoutSignal({
      signal_id: randomUUID(),
      timestamp: now,
      agent_id: `carina:${config.labyrinth.instanceId}`,
      category: 'recommendation',
      action: 'proactive_recommendations_generated',
      target: config.labyrinth.instanceId,
      details: {
        count: recommendations.length,
        recommendations: recommendations.slice(0, 10),
      },
      instance_id: config.labyrinth.instanceId,
    });
  }

  return cachedRecommendations;
}
