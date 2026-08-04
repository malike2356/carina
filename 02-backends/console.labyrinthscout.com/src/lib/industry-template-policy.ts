import type { PolicyDecision, PolicyEvaluateRequest } from '../security/policy-decisions.js';
import {
  getIndustryTemplate,
  requiresHumanReview,
  resolveEventMapping,
  scoutEventTypeForEvaluation,
  type IndustryTemplateId,
} from '../governance/industry-templates.js';
import { getActiveIndustryTemplateId } from './industry-template-store.js';

export interface RegulatoryContext {
  template_id: string;
  regulatory_category: string;
  regulation: string;
  article: string;
  requires_human_review: boolean;
}

export async function resolveActiveTemplateId(
  request: Pick<PolicyEvaluateRequest, 'sessionId' | 'instanceId'>,
): Promise<IndustryTemplateId | null> {
  const bySession = await getActiveIndustryTemplateId(request.sessionId, undefined);
  if (bySession) return bySession;
  return getActiveIndustryTemplateId(undefined, request.instanceId ?? 'default');
}

export function applyIndustryTemplateToDecision(
  decision: PolicyDecision,
  templateId: IndustryTemplateId,
  request: Pick<PolicyEvaluateRequest, 'toolName' | 'actionType'>,
): { decision: PolicyDecision; regulatory_context: RegulatoryContext | null } {
  const template = getIndustryTemplate(templateId);
  const eventType = scoutEventTypeForEvaluation(request.toolName, request.actionType);
  const mapping = resolveEventMapping(templateId, eventType);

  const toolReview = request.toolName
    ? requiresHumanReview(templateId, request.toolName)
    : false;

  const needsReview = toolReview || mapping?.requires_human_review === true;
  let next = { ...decision };

  if (needsReview && next.decision !== 'block' && next.decision !== 'quarantine_session') {
    next = {
      ...next,
      decision: 'require_approval',
      reason: `Industry template '${template.label}' requires human review for this action`,
      riskScore: Math.max(next.riskScore, 70),
    };
  }

  const regulatory_context: RegulatoryContext | null = mapping
    ? {
      template_id: templateId,
      regulatory_category: mapping.regulatory_category,
      regulation: mapping.regulation,
      article: mapping.article,
      requires_human_review: needsReview,
    }
    : toolReview
      ? {
        template_id: templateId,
        regulatory_category: 'Human review required',
        regulation: template.regulations[0] ?? 'Sector regulation',
        article: 'Operator approval',
        requires_human_review: true,
      }
      : null;

  return { decision: next, regulatory_context };
}
