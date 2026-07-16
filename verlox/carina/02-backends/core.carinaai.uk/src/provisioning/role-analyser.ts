import { llm, type ProviderOverride } from '../brain/llm.js';
import type { Message } from '../types/index.js';
import { analyseRoleDescriptionHeuristic } from './role-analyser-heuristic.js';
import {
  DOMAIN_ROLE_TEMPLATE_IDS,
  PROVISION_CHANNELS,
  PROVISION_DOMAINS,
  PROVISION_SKILLS,
  PROVISION_TOOLS,
  type AnalysedRole,
  type ProvisionDomain,
  type RoleAnalysisLlmPayload,
} from './role-analyser-types.js';
import {
  complexityFromToolCount,
  recommendTier,
  type RoleComplexity,
} from './tier-recommender.js';

export type {
  AnalysedRole,
  ProvisionDomain,
  RoleAnalysisLlmPayload,
} from './role-analyser-types.js';
export { formatDomainLabel } from './role-analyser-types.js';

const ROLE_ANALYSIS_SYSTEM_PROMPT = `You are a role analysis engine for AI worker provisioning.

Given a business owner's description, extract a structured role proposal as JSON only.

Fields:
1. suggestedName: short role name (2-4 words)
2. domain: one of customer_support | sales_outreach | property_management | finance_admin | calendar_management | general_assistant
3. responsibilities: array of 2-4 concise responsibility strings
4. requiredTools: subset of email-read, email-send, web-search, web-extract, file-read, file-write, spreadsheet-read, spreadsheet-write, calendar-read, calendar-create, slack-message, whatsapp-message, notion-read, notion-write, crm-read, crm-write
5. requiredSkills: subset of faq-responses, escalation-protocol, tone-matching, ticket-tracking, lead-qualification, follow-up-sequences, property-valuation, tenant-screening, invoice-generation, expense-tracking, meeting-scheduling, reminder-sequences
6. communicationChannels: subset of email, whatsapp, web_chat, slack
7. complexity: simple (at most 2 tools) | moderate (3-5 tools) | complex (6+ tools)
8. confidenceScore: number from 0 to 1

Rules:
- Return valid JSON only. No markdown fences or commentary.
- Do NOT recommend a billing tier or price.
- Pick tools and skills that match the described work.
- complexity must match requiredTools length bands.`;

export function roleAnalyserLlmDisabled(): boolean {
  return process.env.AIVA_ROLE_ANALYSER_DISABLE_LLM === 'true';
}

export function resolveRoleAnalyserOverride(): ProviderOverride | undefined {
  const name = (
    process.env.AIVA_ROLE_ANALYSER_PROVIDER
    ?? process.env.CARINA_TEACHER_PROVIDER
    ?? ''
  ).trim().toLowerCase();
  const model = process.env.AIVA_ROLE_ANALYSER_MODEL?.trim();
  if (!name) return undefined;
  return model ? { name, model } : { name };
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? text.trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, max);
}

function pickAllowed(values: string[], allowed: readonly string[]): string[] {
  const allowedSet = new Set(allowed);
  const picked = values.filter((value) => allowedSet.has(value));
  return [...new Set(picked)];
}

function normalizeDomain(value: unknown): ProvisionDomain {
  const domain = String(value ?? '').trim().toLowerCase();
  if ((PROVISION_DOMAINS as readonly string[]).includes(domain)) {
    return domain as ProvisionDomain;
  }
  return 'general_assistant';
}

function normalizeComplexity(value: unknown, toolCount: number): RoleComplexity {
  const complexity = String(value ?? '').trim().toLowerCase();
  if (complexity === 'simple' || complexity === 'moderate' || complexity === 'complex') {
    return complexity;
  }
  return complexityFromToolCount(toolCount);
}

function normalizeConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.7;
  return Math.max(0, Math.min(1, Math.round(numeric * 100) / 100));
}

export function parseRoleAnalysisPayload(
  text: string,
  roleDescription: string,
): RoleAnalysisLlmPayload | null {
  const parsed = extractJsonObject(text);
  if (!parsed) return null;

  const requiredTools = pickAllowed(asStringArray(parsed.requiredTools, 12), PROVISION_TOOLS);
  const safeTools = requiredTools.length > 0 ? requiredTools : ['email-read', 'email-send'];
  const domain = normalizeDomain(parsed.domain);
  const responsibilities = asStringArray(parsed.responsibilities, 4);
  const requiredSkills = pickAllowed(asStringArray(parsed.requiredSkills, 8), PROVISION_SKILLS);
  const communicationChannels = pickAllowed(
    asStringArray(parsed.communicationChannels, 6),
    PROVISION_CHANNELS,
  );
  const suggestedName = String(parsed.suggestedName ?? '').trim();

  if (!suggestedName || responsibilities.length === 0) return null;

  return {
    suggestedName,
    domain,
    responsibilities,
    requiredTools: safeTools,
    requiredSkills: requiredSkills.length > 0
      ? requiredSkills
      : ['tone-matching', 'escalation-protocol'],
    communicationChannels: communicationChannels.length > 0
      ? communicationChannels
      : ['email'],
    complexity: normalizeComplexity(parsed.complexity, safeTools.length),
    confidenceScore: normalizeConfidence(parsed.confidenceScore),
  };
}

export function finalizeRoleAnalysis(
  payload: RoleAnalysisLlmPayload,
  roleDescription: string,
): AnalysedRole {
  const complexity = normalizeComplexity(payload.complexity, payload.requiredTools.length);
  const recommendedTier = recommendTier(complexity, payload.domain);
  return {
    suggestedName: payload.suggestedName,
    domain: payload.domain,
    responsibilities: payload.responsibilities,
    requiredTools: payload.requiredTools,
    requiredSkills: payload.requiredSkills,
    communicationChannels: payload.communicationChannels,
    complexity,
    recommendedTier,
    confidenceScore: payload.confidenceScore,
    roleTemplateId: DOMAIN_ROLE_TEMPLATE_IDS[payload.domain],
    roleDescription,
  };
}

async function callRoleAnalysisModel(description: string): Promise<string> {
  const messages: Message[] = [
    { role: 'system', content: ROLE_ANALYSIS_SYSTEM_PROMPT, timestamp: new Date() },
  ];
  messages.push({
    role: 'user',
    content: description,
    timestamp: new Date(),
  });
  const response = await llm.chat(messages, undefined, resolveRoleAnalyserOverride());
  return response.content.trim();
}

export async function analyseRoleDescription(rawDescription: string): Promise<AnalysedRole> {
  const roleDescription = rawDescription.trim();
  if (!roleDescription) {
    throw new Error('description is required');
  }

  if (roleAnalyserLlmDisabled()) {
    return analyseRoleDescriptionHeuristic(roleDescription);
  }

  try {
    const content = await callRoleAnalysisModel(roleDescription);
    const payload = parseRoleAnalysisPayload(content, roleDescription);
    if (payload) {
      return finalizeRoleAnalysis(payload, roleDescription);
    }
    console.warn('[role-analyser] LLM response could not be parsed; using heuristic fallback');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[role-analyser] LLM analysis failed (${message}); using heuristic fallback`);
  }

  return analyseRoleDescriptionHeuristic(roleDescription);
}
