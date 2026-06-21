# Feature: Industry-Specific Policy Templates

## Context

Scout already has 9 policy packs (`observe`, `guard`, `restrict`, `quarantine`,
`regulated`, `high-trust`, `dev`, `team`, `prod`) in
`src/security/policy-packs.ts`. These are generic operational postures.

The commercial differentiation in the governance framing comes from vertical-specific
templates: a UK estate agent using an AI agent has different regulatory obligations than
a legal firm or a fintech. The controls, event types, and audit requirements differ.

This feature adds 4 industry templates that extend the existing policy pack system.
Each template:
1. Selects a base policy pack as foundation
2. Adds sector-specific event type classifications
3. Adds sector-specific tool restrictions
4. Adds sector-specific logging requirements
5. Maps to the exact regulations that apply to that sector

Target verticals (in priority order):
- `uk-property` - estate agents, property management (RICS, AML 2017, GDPR)
- `legal-uk` - law firms, legal tech (SRA, Legal Aid Agency, client privilege)
- `finance-uk` - FCA-regulated firms (Consumer Duty, MiFID II reporting, SMCR)
- `healthcare-uk` - health tech (CQC, NHS DSPT, Caldicott principles) - lower priority

## What to build

### 1. `src/governance/industry-templates.ts`

New file. Extends the policy pack system.

```typescript
import type { PolicyPackId, PolicyPack } from '../security/policy-packs.js';

export type IndustryTemplateId =
  | 'uk-property'
  | 'legal-uk'
  | 'finance-uk'
  | 'healthcare-uk';

export interface IndustryEventMapping {
  scout_event_type: string; // Scout's internal event_type
  regulatory_category: string; // e.g. 'AML suspicious transaction'
  regulation: string; // e.g. 'Money Laundering Regulations 2017'
  article: string; // e.g. 'Regulation 19'
  retention_days: number; // how long to keep this event type
  report_threshold: number; // how many events trigger a compliance flag (0 = always flag)
  requires_human_review: boolean; // must a human see this before the agent continues
}

export interface IndustryTemplate {
  id: IndustryTemplateId;
  label: string;
  sector: string;
  regulations: string[]; // list of applicable regulations
  base_pack: PolicyPackId; // foundation policy pack
  event_mappings: IndustryEventMapping[];
  additional_blocked_tools: string[];
  required_audit_fields: string[]; // field names that MUST be present in event metadata
  logging_retention_days: number; // minimum retention for this sector
  human_review_required_for: string[]; // tool names that always need approval
}
```

Define all 4 templates. Full content for each:

---

**`uk-property`:**

```typescript
{
  id: 'uk-property',
  label: 'UK Property & Estate Agency',
  sector: 'Property',
  regulations: [
    'Money Laundering Regulations 2017',
    'Estate Agents Act 1979',
    'RICS Professional Standards',
    'UK GDPR / Data Protection Act 2018',
    'Consumer Protection from Unfair Trading Regulations 2008',
  ],
  base_pack: 'regulated',
  event_mappings: [
    {
      scout_event_type: 'data_access',
      regulatory_category: 'Client identity verification',
      regulation: 'Money Laundering Regulations 2017',
      article: 'Regulation 19 - Customer due diligence',
      retention_days: 2555, // 7 years
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'file_write',
      regulatory_category: 'Document creation or amendment',
      regulation: 'RICS Professional Standards',
      article: 'RICS Rules of Conduct - Record keeping',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'email_send',
      regulatory_category: 'Client communication',
      regulation: 'Consumer Protection from Unfair Trading Regulations 2008',
      article: 'Regulation 6 - Misleading actions',
      retention_days: 1825, // 5 years
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'http_request',
      regulatory_category: 'Third-party data transfer',
      regulation: 'UK GDPR',
      article: 'Article 44 - Transfers to third countries',
      retention_days: 365,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'policy_violation',
      regulatory_category: 'Potential AML flag',
      regulation: 'Money Laundering Regulations 2017',
      article: 'Regulation 21 - Ongoing monitoring',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: true,
    },
  ],
  additional_blocked_tools: ['shell-exec', 'terminal', 'system-command'],
  required_audit_fields: ['client_id', 'property_ref', 'agent_id'],
  logging_retention_days: 2555,
  human_review_required_for: ['email-send', 'file-delete', 'data-export'],
}
```

---

**`legal-uk`:**

```typescript
{
  id: 'legal-uk',
  label: 'UK Legal Services',
  sector: 'Legal',
  regulations: [
    'Solicitors Regulation Authority (SRA) Standards and Regulations 2019',
    'Legal Services Act 2007',
    'Money Laundering Regulations 2017',
    'UK GDPR / Data Protection Act 2018',
    'Legal Aid, Sentencing and Punishment of Offenders Act 2012',
  ],
  base_pack: 'regulated',
  event_mappings: [
    {
      scout_event_type: 'data_access',
      regulatory_category: 'Client file access',
      regulation: 'SRA Standards and Regulations 2019',
      article: 'SRA Code of Conduct 6.3 - Confidentiality',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'file_read',
      regulatory_category: 'Privileged document access',
      regulation: 'Legal Services Act 2007',
      article: 'Section 190 - Legal professional privilege',
      retention_days: 3650, // 10 years
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'email_send',
      regulatory_category: 'Client communication - privilege risk',
      regulation: 'SRA Standards and Regulations 2019',
      article: 'SRA Code of Conduct 6.4 - Confidentiality duties',
      retention_days: 3650,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'data_export',
      regulatory_category: 'Client data export',
      regulation: 'UK GDPR',
      article: 'Article 17 - Right to erasure',
      retention_days: 3650,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'policy_violation',
      regulatory_category: 'SRA breach indicator',
      regulation: 'SRA Standards and Regulations 2019',
      article: 'SRA Principles - Principle 7 (trust)',
      retention_days: 3650,
      report_threshold: 0,
      requires_human_review: true,
    },
  ],
  additional_blocked_tools: ['shell-exec', 'terminal', 'system-command', 'database-direct'],
  required_audit_fields: ['matter_ref', 'client_id', 'fee_earner_id'],
  logging_retention_days: 3650,
  human_review_required_for: ['email-send', 'file-delete', 'data-export', 'http-request'],
}
```

---

**`finance-uk`:**

```typescript
{
  id: 'finance-uk',
  label: 'UK Financial Services',
  sector: 'Finance',
  regulations: [
    'Financial Services and Markets Act 2000 (FSMA)',
    'FCA Consumer Duty (PS22/9)',
    'MiFID II / UK MiFIR',
    'Senior Managers and Certification Regime (SMCR)',
    'Money Laundering Regulations 2017',
    'UK GDPR / Data Protection Act 2018',
  ],
  base_pack: 'restricted',  // more restrictive base than property/legal
  event_mappings: [
    {
      scout_event_type: 'tool_call',
      regulatory_category: 'Automated decision affecting customer',
      regulation: 'FCA Consumer Duty (PS22/9)',
      article: 'Outcome 4 - Consumer support',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'data_access',
      regulatory_category: 'Customer data processing',
      regulation: 'FCA Consumer Duty (PS22/9)',
      article: 'Outcome 2 - Products and services',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'http_request',
      regulatory_category: 'Third-party API call (outsourcing)',
      regulation: 'FSMA 2000 s.137A / FCA SYSC 8',
      article: 'SYSC 8.1.1 - Outsourcing requirements',
      retention_days: 2555,
      report_threshold: 10,
      requires_human_review: false,
    },
    {
      scout_event_type: 'email_send',
      regulatory_category: 'Financial promotion or advice',
      regulation: 'FSMA 2000 s.21 - Financial promotion',
      article: 'Section 21 - Restrictions on financial promotion',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'policy_violation',
      regulatory_category: 'SMCR accountability trigger',
      regulation: 'Senior Managers and Certification Regime',
      article: 'SYSC 26 - Management responsibilities map',
      retention_days: 2555,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'anomaly',
      regulatory_category: 'Market abuse indicator',
      regulation: 'Market Abuse Regulation (UK MAR)',
      article: 'Article 16 - Suspicious transaction reporting',
      retention_days: 2555,
      report_threshold: 1,
      requires_human_review: true,
    },
  ],
  additional_blocked_tools: ['shell-exec', 'terminal', 'system-command', 'database-direct', 'file-delete'],
  required_audit_fields: ['customer_id', 'firm_ref', 'senior_manager_id'],
  logging_retention_days: 2555,
  human_review_required_for: ['email-send', 'data-export', 'payment-initiate', 'advice-generate'],
}
```

---

**`healthcare-uk`:**

```typescript
{
  id: 'healthcare-uk',
  label: 'UK Health & Social Care',
  sector: 'Healthcare',
  regulations: [
    'NHS Data Security and Protection Toolkit (DSPT)',
    'Caldicott Principles (National Data Guardian)',
    'Care Quality Commission (CQC) Standards',
    'UK GDPR / Data Protection Act 2018',
    'Health and Social Care (Safety and Quality) Act 2015',
  ],
  base_pack: 'regulated',
  event_mappings: [
    {
      scout_event_type: 'data_access',
      regulatory_category: 'Patient data access',
      regulation: 'Caldicott Principles',
      article: 'Principle 1 - Justify the purpose',
      retention_days: 2920, // 8 years NHS standard
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'file_read',
      regulatory_category: 'Medical record access',
      regulation: 'NHS DSPT - Standard 9',
      article: 'NHS DSPT Data Security Standard 9.1',
      retention_days: 2920,
      report_threshold: 0,
      requires_human_review: false,
    },
    {
      scout_event_type: 'data_export',
      regulatory_category: 'Patient data transfer',
      regulation: 'UK GDPR / NHS DSPT',
      article: 'UK GDPR Article 44 + NHS DSPT Standard 7',
      retention_days: 2920,
      report_threshold: 0,
      requires_human_review: true,
    },
    {
      scout_event_type: 'policy_violation',
      regulatory_category: 'CQC notification trigger',
      regulation: 'Care Quality Commission (Registration) Regulations 2009',
      article: 'Regulation 18 - Notification of other incidents',
      retention_days: 2920,
      report_threshold: 0,
      requires_human_review: true,
    },
  ],
  additional_blocked_tools: ['shell-exec', 'terminal', 'database-direct'],
  required_audit_fields: ['patient_id_hash', 'clinician_id', 'care_setting'],
  logging_retention_days: 2920,
  human_review_required_for: ['data-export', 'email-send', 'file-delete'],
}
```

---

Export a lookup and helpers:

```typescript
export const INDUSTRY_TEMPLATES: Record<IndustryTemplateId, IndustryTemplate> = {
  'uk-property': ukPropertyTemplate,
  'legal-uk': legalUkTemplate,
  'finance-uk': financeUkTemplate,
  'healthcare-uk': healthcareUkTemplate,
};

export function getIndustryTemplate(id: IndustryTemplateId): IndustryTemplate {
  return INDUSTRY_TEMPLATES[id];
}

export function listIndustryTemplates(): IndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES);
}

export function resolveEventMapping(
  templateId: IndustryTemplateId,
  eventType: string,
): IndustryEventMapping | null {
  const template = INDUSTRY_TEMPLATES[templateId];
  return template.event_mappings.find(m => m.scout_event_type === eventType) ?? null;
}

export function requiresHumanReview(
  templateId: IndustryTemplateId,
  toolName: string,
): boolean {
  const template = INDUSTRY_TEMPLATES[templateId];
  return template.human_review_required_for.includes(toolName);
}
```

### 2. `src/api/industry-templates.ts`

New Express router mounted at `/api/governance/templates` in `server.ts`.

```
GET /api/governance/templates
```
Returns `listIndustryTemplates()` as JSON. Requires `requireApiKey`.

```
GET /api/governance/templates/:id
```
Returns a single template. 404 if not found.

```
POST /api/governance/templates/:id/apply
Body: { instance_id?: string, session_id?: string, applied_by: string }
```
Applies the template's base pack to the given scope using `applyPolicyPack`.
Stores the active template ID in Redis under `scout:industry_template:{scope_key}`.
Returns `{ applied: true, template_id, base_pack_applied, human_review_tools }`.

```
GET /api/governance/templates/active
```
Returns the currently active template (if any) from Redis. Returns `null` if none applied.

Mount in `server.ts`:
```typescript
import { industryTemplatesRouter } from './api/industry-templates.js';
app.use('/api/governance/templates', requireApiKey, industryTemplatesRouter);
```

### 3. Integrate into policy evaluation

In `src/api/policy-evaluate.ts`, inside the `POST /evaluate` handler:

After computing the base policy decision, check if an industry template is active for the
instance. If yes:
1. Call `resolveEventMapping(templateId, req.tool_name)` to get the regulatory mapping.
2. If `requires_human_review` is true for this tool, override the decision to
   `require_approval` regardless of the base policy decision (unless it was already
   `block`).
3. Add the regulatory context to the response:

```typescript
interface PolicyDecision {
  // ... existing fields ...
  regulatory_context?: {
    template_id: string;
    regulatory_category: string;
    regulation: string;
    article: string;
    requires_human_review: boolean;
  } | null;
}
```

This is the mechanism that makes industry templates active enforcement, not just labels.

### 4. `GET /api/governance/posture` update

In `src/api/governance.ts` (created in `feature-governance-dashboard.md`), add the
active template to the posture response:

```typescript
active_industry_template: {
  id: IndustryTemplateId;
  label: string;
  sector: string;
  regulations: string[];
} | null;
```

Include in the board report PDF as "Active Governance Template" section.

### 5. Dashboard display

In `public/governance.html` (created in `feature-governance-dashboard.md`), add a
"Governance Template" card in the bottom row:

```
[ACTIVE TEMPLATE]
UK Property & Estate Agency
Regulations: AML 2017, RICS, GDPR
Tools requiring human review: email-send, file-delete, data-export
[ Change Template v ]  <- dropdown to switch templates
```

The dropdown lists all 4 templates. On change, POST to
`/api/governance/templates/{id}/apply` with the current instance_id.

If no template active: show "No industry template applied. Select one for sector-specific
governance." with a button to choose.

### 6. Tests

File: `src/governance/__tests__/industry-templates.test.ts`

10 tests:

1. `listIndustryTemplates returns 4 templates`
2. `getIndustryTemplate returns correct template for uk-property`
3. `uk-property: policy_violation maps to AML flag and requires_human_review=true`
4. `legal-uk: email_send maps to SRA confidentiality and requires_human_review=true`
5. `finance-uk: anomaly maps to Market Abuse Regulation`
6. `requiresHumanReview: true for email-send in legal-uk`
7. `requiresHumanReview: false for tool not in human_review_required_for list`
8. `resolveEventMapping: returns null for unmapped event type`
9. `finance-uk base_pack is restrict (more restrictive than property/legal)`
10. `healthcare-uk retention is 2920 days (8 years)`

File: `src/api/__tests__/industry-templates-api.test.ts`

5 tests:

1. `GET /api/governance/templates returns 200 with array of 4`
2. `GET /api/governance/templates/uk-property returns correct template`
3. `GET /api/governance/templates/invalid returns 404`
4. `POST /api/governance/templates/uk-property/apply returns applied:true`
5. `GET /api/governance/templates/active returns null before any template applied`

## Files to create/modify

- CREATE `src/governance/industry-templates.ts`
- CREATE `src/api/industry-templates.ts`
- CREATE `src/governance/__tests__/industry-templates.test.ts`
- CREATE `src/api/__tests__/industry-templates-api.test.ts`
- MODIFY `src/api/policy-evaluate.ts` - add regulatory_context to decision response
- MODIFY `src/api/governance.ts` - add active_industry_template to posture response
- MODIFY `public/governance.html` - add template card (if that file exists)
- MODIFY `src/server.ts` - mount industryTemplatesRouter

## Do not change

- `src/security/policy-packs.ts` - templates extend the pack system, not replace it
- `src/security/policy-decisions.ts` - do not change existing decision types
- Any existing tests

## Acceptance check

Run `npm test`. All tests pass including the 15 new ones.
`curl -H "X-Scout-Key: $SCOUT_API_KEY" http://localhost:4444/api/governance/templates`
returns JSON array with 4 templates, each having `regulations` and `event_mappings` arrays.
