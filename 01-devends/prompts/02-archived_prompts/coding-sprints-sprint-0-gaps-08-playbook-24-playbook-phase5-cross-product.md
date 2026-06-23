# Prompt 24 - Cross-Product Integration (Playbook Phase 5)

## Objective

Wire playbook into Carina agent tools, Propreneur deal pipeline, Scout incidents, and Xelox daily deals. Playbook decides; other systems execute.

---

## Context

**Depends on:** Prompt 22 (domain plays stable)

**Read:** COOKBOOK_TO_PLAYBOOK_ROADMAP Phase 5

**Working directories:** `core.carinaai.uk`, integration stubs in propreneur/scout as applicable

---

## Step 1 - Playbook agent tool

`src/playbook/tools/playbook-tool.ts`:

Register in tool registry as `playbook`:

```typescript
// Input: { goal?: string, trigger?: string, domain?: string, inputs?: object }
// Output: PlaybookResponse JSON + human-readable summary
```

Agent can invoke when user asks "what should I do given..."

---

## Step 2 - Execute confirmation flow

`src/playbook/execution-plan.ts`:

When `confirmationRequired` and user confirms via chat or CLI `--execute`:

- Map path steps to tool calls (research job, document create, scout quarantine, etc.)
- Run sequentially with audit log entry

CLI:
```
carina playbook "<goal>" --execute --confirm
```

---

## Step 3 - Propreneur webhook (contract only)

Create `core.carinaai.uk/docs/integrations/PROPRENEUR_PLAYBOOK_WEBHOOK.md`:

```
POST /api/integrations/propreneur/playbook
Body: { dealId, stage, trigger, inputs }
Response: PlaybookResponse
```

Implement route handler that calls `evaluatePlay` for property domain. Propreneur UI integration is a separate propreneur prompt; this prompt delivers the API.

---

## Step 4 - Scout integration

On Scout alert type mapping:

| Alert | Play trigger |
|-------|--------------|
| injection_blocked | injection-detected |
| anomaly_zscore | anomaly-spike |
| honeypot_hit | breach-confirmed |
| egress_blocked | egress-blocked |

`src/scout/playbook-bridge.ts` calls evaluator, attaches recommendation to alert payload for ops dashboard.

---

## Step 5 - End-to-end test

Scenario: vendor counter 12% above max, property score 82
- Propreneur webhook returns `split_difference` recommended
- Execution plan lists draft offer + schedule follow-up tools
- Audit log entry created

---

## Acceptance criteria

- [ ] `playbook` tool registered and callable from agent
- [ ] Scout bridge attaches playbook summary to test alert
- [ ] Propreneur webhook documented and returns valid JSON
- [ ] Execute path requires explicit confirm

## Out of scope

- Full Propreneur UI buttons (separate repo task)
- n8n workflow replacement
