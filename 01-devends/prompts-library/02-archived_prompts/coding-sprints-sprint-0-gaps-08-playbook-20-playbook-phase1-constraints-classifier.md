# Prompt 20 - Constraints + Task Classifier (Playbook Phase 1)

## Objective

Create `src/playbook/` in `core.carinaai.uk`. Replace the user-facing question "what model fits my hardware?" with "given my situation, what should I do?" Phase 1 adds vocabulary: task profiles, constraints, classification.

**Naming:** Playbook, not cookbook. Cookbook remains internal at `src/cookbook/`.

---

## Context

**Working directory:** `/opt/lampp/htdocs/verlox/carina/core.carinaai.uk`

**Read first:**
- `instructions/strategy/COOKBOOK_TO_PLAYBOOK_ROADMAP.md` (Phase 1)
- `src/cookbook/recommender.ts`, `src/cookbook/types.ts`
- `src/brain/task-classifier.ts` (if exists)

---

## Step 1 - Directory and types

Create `src/playbook/types.ts`:

```typescript
export type TaskType =
  | 'document_analysis'
  | 'document_generation'
  | 'data_extraction'
  | 'summarization'
  | 'code_generation'
  | 'research_synthesis'
  | 'compliance_check'
  | 'deal_analysis'
  | 'communication_draft'
  | 'scheduled_report'
  | 'model_selection'
  | 'unknown';

export type BudgetPreference = 'cheapest' | 'balanced' | 'unconstrained';
export type QualityMinimum = 'draft' | 'production' | 'compliance' | 'legal';
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

export interface TaskConstraints {
  deadline?: string;
  maxDurationMinutes?: number;
  budgetHardLimit?: number;
  budgetPreference?: BudgetPreference;
  containsPII?: boolean;
  requiresOffline?: boolean;
  dataResidencyCountry?: string;
  maxDataClassification?: DataClassification;
  qualityMinimum?: QualityMinimum;
  requiresHumanReview?: boolean;
  maxConcurrency?: number;
  preferredProvider?: string;
  excludedProviders?: string[];
  requiresAuditTrail?: boolean;
}

export interface TaskProfile {
  goal: string;
  taskType: TaskType;
  scale?: { documentCount?: number; recordCount?: number };
  constraints: TaskConstraints;
}

export interface PlaybookResponse {
  recommendedPathId: string;
  reasoning: string[];
  allPaths: ScoredPath[];
  tradeoffs: string;
  risks: RiskFlag[];
  confirmationRequired: boolean;
}

export interface ScoredPath {
  id: string;
  label: string;
  score: number;
  steps: string[];
  estimatedCostGbp?: number;
  estimatedMinutes?: number;
}

export interface RiskFlag {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}
```

---

## Step 2 - constraints.ts

- `parseConstraints(input: unknown): TaskConstraints` with defaults
- `validateConstraints(c: TaskConstraints): string[]` errors
- Unit tests: PII + offline conflict, budget negative rejected

---

## Step 3 - task-classifier.ts

- `classifyTask(goal: string): TaskType`
- Rule-based first (keyword patterns per COOKBOOK_TO_PLAYBOOK_ROADMAP table)
- Optional LLM fallback behind `PLAYBOOK_USE_LLM_CLASSIFIER=true` (never default on hot path)
- 50+ fixture tests in `task-classifier.test.ts`

---

## Step 4 - playbook/index.ts barrel

Export public API:
- `classifyTask`
- `parseConstraints`
- `buildTaskProfile(goal, rawConstraints)`

---

## Step 5 - CLI stub

`src/cli/commands/playbook-cli.ts`:

```
carina playbook classify "<goal>"
carina playbook constraints --json '{...}'
```

Register in `src/cli/registry.ts`.

---

## Acceptance criteria

- [ ] `src/playbook/` exists with types, constraints, classifier, tests
- [ ] `classifyTask("Analyze 200 property documents by tomorrow")` returns `document_analysis`
- [ ] No changes to `src/cookbook/` behavior
- [ ] `pnpm test` passes for playbook module
