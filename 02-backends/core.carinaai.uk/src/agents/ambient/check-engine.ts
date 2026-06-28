import { config } from '../../config/index.js';
import { isAmbientChecksEnabledForChannel, getAmbientChannelSettings } from './ambient-channel-settings.js';
import { listAmbientChannels, queryChannelFacts } from './channel-memory-store.js';
import type { AmbientChannel, AmbientCheck } from './types.js';

export class AmbientCheckEngine {
  private lastCheckTime = new Map<string, number>();

  constructor(private readonly checkIntervalMs = config.ambient.checkIntervalMs) {}

  async runAmbientChecks(): Promise<AmbientCheck[]> {
    const checks: AmbientCheck[] = [];
    const now = Date.now();
    const channels = await this.getAmbientChannels();

    for (const channel of channels) {
      if (!(await isAmbientChecksEnabledForChannel(channel.id))) continue;

      const lastCheck = this.lastCheckTime.get(channel.id) ?? 0;
      if (now - lastCheck < this.checkIntervalMs) continue;
      this.lastCheckTime.set(channel.id, now);

      const settings = await getAmbientChannelSettings(channel.id, channel.name);
      const dismissed = new Set(settings.dismissedCheckIds);

      checks.push(
        ...(await this.checkStaleThreads(channel)).filter((c) => !dismissed.has(c.sourceFactIds[0] ?? '')),
        ...(await this.checkApproachingDeadlines(channel)).filter((c) => !dismissed.has(c.sourceFactIds[0] ?? '')),
        ...(await this.checkUnresolvedBlockers(channel)).filter((c) => !dismissed.has(c.sourceFactIds[0] ?? '')),
        ...(await this.checkKnowledgeGaps(channel)).filter((c) => !dismissed.has(c.sourceFactIds[0] ?? '')),
        ...(await this.checkCrossChannelSignals(channel)).filter((c) => !dismissed.has(c.sourceFactIds[0] ?? '')),
      );
    }

    return prioritise(checks);
  }

  private async getAmbientChannels(): Promise<AmbientChannel[]> {
    return listAmbientChannels();
  }

  private async checkStaleThreads(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await queryChannelFacts({
      scope: `channel:${channel.id}`,
      factType: 'status_update',
      orderBy: 'extracted_at',
      order: 'ASC',
    });
    const staleMs = 3 * 24 * 60 * 60 * 1000;
    return facts
      .filter((f) => Date.now() - new Date(f.extractedAt).getTime() > staleMs)
      .map((f) => ({
        type: 'stale_thread' as const,
        priority: 'low' as const,
        channelId: channel.id,
        channelName: channel.name,
        message: `This has not had an update in a few days: "${f.summary}". Is it still active?`,
        sourceFactIds: [f.id],
        suggestedAction: 'Check in with the owner or mark resolved.',
      }));
  }

  private async checkApproachingDeadlines(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await queryChannelFacts({
      scope: `channel:${channel.id}`,
      factType: 'deadline',
    });
    const windowMs = 2 * 24 * 60 * 60 * 1000;
    const checks: AmbientCheck[] = [];

    for (const fact of facts) {
      const dates = (fact.metadata.entities as { dates?: string[] } | undefined)?.dates;
      const deadlineDate = dates?.[0];
      if (!deadlineDate) continue;
      const deadline = new Date(deadlineDate).getTime();
      const timeLeft = deadline - Date.now();
      if (timeLeft <= 0 || timeLeft >= windowMs) continue;
      const hoursLeft = Math.round(timeLeft / (60 * 60 * 1000));
      checks.push({
        type: 'approaching_deadline',
        priority: timeLeft < 24 * 60 * 60 * 1000 ? 'high' : 'medium',
        channelId: channel.id,
        channelName: channel.name,
        message: `"${fact.summary}" is due in about ${hoursLeft} hours.`,
        sourceFactIds: [fact.id],
        suggestedAction: 'Check progress with the owner.',
      });
    }
    return checks;
  }

  private async checkUnresolvedBlockers(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await queryChannelFacts({
      scope: `channel:${channel.id}`,
      factType: 'blocker',
      orderBy: 'extracted_at',
    });
    const staleMs = 24 * 60 * 60 * 1000;
    return facts
      .filter((f) => Date.now() - new Date(f.extractedAt).getTime() > staleMs)
      .map((f) => ({
        type: 'blocker_unresolved' as const,
        priority: 'high' as const,
        channelId: channel.id,
        channelName: channel.name,
        message: `This blocker was flagged but I have not seen a resolution: "${f.summary}".`,
        sourceFactIds: [f.id],
        suggestedAction: 'Escalate or update status.',
      }));
  }

  private async checkKnowledgeGaps(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await queryChannelFacts({
      scope: `channel:${channel.id}`,
      factType: 'knowledge_gap',
      orderBy: 'extracted_at',
    });
    const gapMs = 12 * 60 * 60 * 1000;
    return facts
      .filter((f) => Date.now() - new Date(f.extractedAt).getTime() > gapMs)
      .map((f) => ({
        type: 'knowledge_gap' as const,
        priority: 'low' as const,
        channelId: channel.id,
        channelName: channel.name,
        message: `This question still seems unanswered: "${f.summary}". Can anyone help?`,
        sourceFactIds: [f.id],
      }));
  }

  private async checkCrossChannelSignals(channel: AmbientChannel): Promise<AmbientCheck[]> {
    const facts = await queryChannelFacts({
      scope: `channel:${channel.id}`,
      limit: 50,
    });
    const projects = new Set<string>();
    for (const fact of facts) {
      const entities = fact.metadata.entities as { projects?: string[] } | undefined;
      for (const project of entities?.projects ?? []) projects.add(project);
    }
    if (projects.size === 0) return [];

    const checks: AmbientCheck[] = [];
    for (const project of projects) {
      const crossFacts = await queryChannelFacts({
        scopeNot: `channel:${channel.id}`,
        search: project,
        limit: 3,
      });
      if (crossFacts.length === 0) continue;
      const sourceChannels = [...new Set(crossFacts.map((f) => f.scopeName || f.scope))];
      checks.push({
        type: 'cross_channel_signal',
        priority: 'medium',
        channelId: channel.id,
        channelName: channel.name,
        message: `Updates about "${project}" appeared in ${sourceChannels.join(', ')}. Might be relevant here.`,
        sourceFactIds: crossFacts.map((f) => f.id),
        suggestedAction: 'Review the cross-channel updates.',
      });
    }
    return checks;
  }
}

function prioritise(checks: AmbientCheck[]): AmbientCheck[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...checks].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );
  const perChannel = new Map<string, AmbientCheck[]>();
  for (const check of sorted) {
    const existing = perChannel.get(check.channelId) ?? [];
    if (existing.length < 3) {
      existing.push(check);
      perChannel.set(check.channelId, existing);
    }
  }
  return [...perChannel.values()].flat();
}
