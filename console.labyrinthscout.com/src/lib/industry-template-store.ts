import { getRedis } from '../redis.js';
import {
  getIndustryTemplate,
  isIndustryTemplateId,
  type IndustryTemplate,
  type IndustryTemplateId,
} from '../governance/industry-templates.js';

const KEY_PREFIX = 'scout:industry_template:';
const memoryStore = new Map<string, IndustryTemplateId>();

export function industryTemplateScopeKey(sessionId?: string, instanceId?: string): string {
  return sessionId ? `session:${sessionId}` : `instance:${instanceId ?? 'default'}`;
}

function redisKey(scopeKey: string): string {
  return `${KEY_PREFIX}${scopeKey}`;
}

export async function getActiveIndustryTemplateId(
  sessionId?: string,
  instanceId?: string,
): Promise<IndustryTemplateId | null> {
  const scopeKey = industryTemplateScopeKey(sessionId, instanceId);
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get(redisKey(scopeKey));
      if (value && isIndustryTemplateId(value)) return value;
    } catch {
      /* fall through to memory */
    }
  }
  const mem = memoryStore.get(scopeKey);
  return mem ?? null;
}

export async function setActiveIndustryTemplate(
  templateId: IndustryTemplateId,
  sessionId?: string,
  instanceId?: string,
): Promise<void> {
  const scopeKey = industryTemplateScopeKey(sessionId, instanceId);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(redisKey(scopeKey), templateId);
      memoryStore.set(scopeKey, templateId);
      return;
    } catch {
      /* fall through */
    }
  }
  memoryStore.set(scopeKey, templateId);
}

export async function getActiveIndustryTemplateSummary(
  sessionId?: string,
  instanceId?: string,
): Promise<Pick<IndustryTemplate, 'id' | 'label' | 'sector' | 'regulations' | 'human_review_required_for'> | null> {
  const templateId = await getActiveIndustryTemplateId(sessionId, instanceId);
  if (!templateId) return null;
  const template = getIndustryTemplate(templateId);
  return {
    id: template.id,
    label: template.label,
    sector: template.sector,
    regulations: template.regulations,
    human_review_required_for: template.human_review_required_for,
  };
}

export function resetIndustryTemplateStoreForTests(): void {
  memoryStore.clear();
}
