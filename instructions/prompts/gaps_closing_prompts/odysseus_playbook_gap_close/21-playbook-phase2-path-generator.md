# Prompt 21 - Playbook Phase 2: Path Generator + Scorer

## Objective

Generate 4 paths per task (Fastest, Cheapest, Safest, Balanced), score against constraints, return `PlaybookResponse` with reasoning. Wrap `cookbook/recommender` as capability input, do not replace it.

---

## Context

**Working directory:** `core.carinaai.uk`

**Depends on:** Prompt 20

**Read:** COOKBOOK_TO_PLAYBOOK_ROADMAP Phase 2

---

## Step 1 - capability-map.ts

```typescript
export interface CapabilityMap {
  localModels: Array<{ id: string; vramGb: number; ramGb: number }>;
  cloudProviders: Array<{ id: string; hasKey: boolean }>;
  hardwareTier: 'cpu-only' | 'low-vram' | 'mid-vram' | 'high-vram';
  toolsAvailable: string[];
  domainPacksLoaded: string[];
}

export async function buildCapabilityMap(): Promise<CapabilityMap>
```

- Call `cookbook/hardware.ts` + `cookbook/recommender.ts` for local models
- Read configured providers from `provider-registry`
- List loaded domain packs from pack loader

---

## Step 2 - path-generator.ts

`generatePaths(profile: TaskProfile, capabilities: CapabilityMap): RawPath[]`

For each task type, apply rules from roadmap section 2.1:

| Path ID | Strategy |
|---------|----------|
| `fastest` | Largest cloud model, parallel where possible |
| `cheapest` | Local GGUF or cheapest API tier |
| `safest` | Local-only, PII redaction step, audit trail |
| `balanced` | Weighted mix |

Each `RawPath`: `{ id, label, steps: string[], modelId?, providerId?, requiresNetwork }`

Minimum 3 distinct paths per request; 4 when constraints allow.

---

## Step 3 - path-scorer.ts

`scorePaths(paths: RawPath[], profile: TaskProfile): ScoredPath[]`

Weights from constraints (roadmap section 2.3):
- `containsPII` -> riskWeight 0.6
- `budgetPreference=cheapest` -> costWeight 0.5
- `qualityMinimum=legal` -> qualityWeight 0.6
- `deadline` within 24h -> speedWeight 0.5

Estimate cost (rough API $/1M tokens table in config) and duration heuristics.

---

## Step 4 - playbook-response.ts

`buildPlaybookResponse(profile, scoredPaths): PlaybookResponse`

- Pick highest score as `recommendedPathId`
- Build `reasoning[]` from eliminated paths ("PII rules out cloud-only")
- `tradeoffs` one-liner comparing top 2
- `risks` from PII, cloud, legal quality flags
- `confirmationRequired: true` if any high severity risk

---

## Step 5 - CLI

```
carina playbook "<goal>" [--budget 50] [--pii] [--offline] [--deadline ISO]
carina playbook hardware   # delegates to cookbook recommender only (migration shim)
```

Output formatted terminal table of 4 paths + recommended.

---

## Step 6 - Integration test

Fixture: "Analyze 200 docs with PII, 50 GBP budget, 24h deadline"
- Assert 4 paths returned
- Assert safest or balanced recommended (not fastest cloud-only)
- Assert reasoning mentions PII

---

## Acceptance criteria

- [ ] `carina playbook "..."` prints 4 scored paths with reasoning
- [ ] Cookbook hardware still used inside capability map
- [ ] All tests pass
