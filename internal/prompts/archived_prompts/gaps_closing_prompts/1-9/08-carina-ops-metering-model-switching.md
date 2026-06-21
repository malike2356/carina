# Prompt: Implement Carina Ops Metering, Model Switching, and Margin-Safe Billing

**Status: partial (backend primitives done; workbench, estimate UI, margin reporting open)**
**Follow-up checklist:** `09-workbench-metering-checklist.md`

You are working in `/opt/lampp/htdocs/verlox/carina`.

Goal
Complete the Carina Ops metering work described in `instructions/strategy/Carina_OP_Metering.md` without breaking any working system. The product must remain stable while you add weighted credits, model switching, billing gates, and usage tracking. This is a commercial system, so the implementation must be economically viable. Do not create a plan that can lose money on inference.

This is not a greenfield rewrite. Read the existing code first, understand the current billing and usage paths, then make the smallest safe change that closes the gap.

Read these first
- `instructions/strategy/Carina_OP_Metering.md`
- `instructions/strategy/Carina_Ops_Claude_Platform_Compare.md`
- `core.carinaai.uk/src/brain/llm.ts`
- `core.carinaai.uk/src/brain/openai-compatible-provider.ts`
- `core.carinaai.uk/src/brain/cost-tracker.ts`
- `core.carinaai.uk/src/billing/plans.ts`
- `core.carinaai.uk/src/billing/usage-meter.ts`
- `core.carinaai.uk/src/billing/stripe-service.ts`
- `core.carinaai.uk/src/billing/subscription-manager.ts`
- `core.carinaai.uk/src/hosted/usage-service.ts`
- `core.carinaai.uk/src/hosted/plan-features.ts`
- `core.carinaai.uk/src/hosted/plan-gates.ts`
- `core.carinaai.uk/src/api/carina-ops-routes.ts`
- `ops.carinaai.uk/routes/ai-platform.ts`
- `ops.carinaai.uk/lib/ai-platform.ts`
- `ops.carinaai.uk/views/ai-platform/*`

Non-negotiable constraints
- Do not break the existing chat, model execution, subscription, or usage flows.
- Keep backward compatibility with existing token tracking where required.
- Preserve the current internal cost ledger and add the new billing ledger alongside it.
- Do not expose raw provider economics to normal users.
- No unlimited managed inference on paid plans.
- Model switching must respect plan entitlements and margin controls.
- BYOK plans must remain viable and must not accidentally route through your paid inference path.
- Do not add a new dependency unless there is no reasonable alternative.
- Use the existing database, route, and test patterns already in the repo.
- ASCII only. No emojis. No em dashes or en dashes.

Business model to implement
- Carina AI stays free for personal use.
- Carina Ops is the paid control plane.
- Paid plans include a monthly credit allowance.
- Credits are a commercial unit, not raw tokens.
- Expensive models burn credits faster than cheap ones.
- Premium model access must be gated by plan or BYOK.
- If a request would put the org into an uneconomic state, block it, downgrade it, or require top-up.

Pricing and metering rules
- Meter input tokens, output tokens, cached input tokens, provider, model, and tool calls where they have real cost.
- Convert usage into weighted credits using a rate card.
- Use model classes: `mini`, `balanced`, `premium`, `frontier`.
- Default routing should prefer the cheapest acceptable model.
- Model choice should be allowed at the UI level, but billing must always reflect the actual model class used.
- Keep a minimum gross margin target of 65 percent on managed inference.
- If a plan cannot support a model class at profitable margins, do not pretend it can. Block it or force BYOK.
- Keep historical usage immutable when pricing changes. Use versioned rate cards.

What to build

1. Directional token capture
- Ensure the LLM call path preserves `tokensIn`, `tokensOut`, and `tokensCached` separately.
- Keep `tokensUsed` only as a compatibility field where needed.
- Capture provider values from the actual response object, not a post hoc estimate.
- Update any typed response objects so the new fields flow through the system cleanly.

2. Rate card and model class logic
- Add a shared rate card module for classifying models into `mini`, `balanced`, `premium`, and `frontier`.
- Add the weighted credit formula.
- Make rate cards versioned and data driven.
- Seed the initial weights in a migration or equivalent bootstrap path.
- Map unknown models conservatively. Do not undercharge by default.

3. Credit ledger
- Add a customer billing ledger separate from internal cost tracking.
- Record debits for usage and credits for top-ups or grants.
- Balance should be derived from ledger history and plan allowance, not a mutable counter alone.
- Monthly usage totals must be queryable by org and by month.

4. Credit gate
- Before an LLM call, verify the org is allowed to use the target model class.
- Check remaining allowance and block or warn before an expensive call can create a loss.
- Allow BYOK accounts to bypass managed inference cost exposure where appropriate.
- If the request is close to the allowance limit, emit a warning that can be shown in the UI.

5. Model switching and routing
- Add model switching support to the product where it already makes sense.
- Expose simple routing classes in the UI, not a confusing list of provider internals.
- Route to the cheapest acceptable model by default.
- Permit explicit model selection only when the plan allows it.
- If a selected model is too expensive for the org, downgrade it or block it with a clear reason.

6. Billing and usage endpoints
- Add endpoints to estimate usage before execution.
- Add endpoints to record finalized usage after execution.
- Add endpoints to report monthly usage, remaining credits, and model class entitlement.
- Keep the current APIs working for existing consumers.

7. Carina Ops UI
- Update the workbench and credits surfaces so the customer can see:
  - included credits
  - used credits
  - remaining credits
  - model class in use
  - estimated burn before run
  - actual burn after run
  - top-up or upgrade prompts when needed
- Keep the UI operational and compact. Do not turn it into a marketing page.

8. Tests
- Add focused tests for:
  - model classification
  - weighted credit calculation
  - credit gate allow and block behavior
  - monthly balance calculation
  - debit and top-up ledger writes
  - any route logic that can be tested without a browser
- Prefer unit tests over broad snapshots.

Implementation plan

Phase 1
- Read the existing flow end to end.
- Identify where tokens are currently collapsed into a single count.
- Add directional token capture.
- Add the rate card and credit formula.
- Add tests for classification and credit math.

Phase 2
- Add the ledger and gate.
- Wire the gate into the LLM execution path.
- Make sure failed or blocked calls fail cleanly and do not corrupt session state.
- Preserve existing internal reconciliation and usage tracking.

Phase 3
- Add model switching and routing policy.
- Update the workbench and credits UI so users can see cost and allowance clearly.
- Add monthly usage reporting.

Phase 4
- Harden the economics.
- Verify managed inference cannot go negative margin.
- Verify BYOK does not get billed as managed inference.
- Recheck the plan entitlements and defaults.

Technical rules
- Keep schema changes additive where possible.
- Do not rename tables or remove existing columns unless there is no safe alternative.
- Use migrations or the repo's established bootstrap path.
- Keep functions small and explicit. Avoid clever abstractions that hide billing logic.
- Make sure all calculations round consistently and predictably.
- Store both estimated and actual usage if the code path supports both.
- Keep provider cost and customer billable credits separate.

What not to do
- Do not build a token marketplace.
- Do not expose raw provider margins in the UI.
- Do not add unlimited plans.
- Do not let premium models run on low-margin plans without a gate.
- Do not break the existing Carina AI agent flow to ship Carina Ops billing.
- Do not create a second billing stack.

Validation
- Run the relevant unit tests for billing, rate cards, and credit gating.
- Run the type check for the touched workspace.
- Run the existing build or smoke test for the affected product area.
- Confirm that normal chat and session flows still work after the change.

Deliverable
Implement the metering, model switching, and margin-safe billing changes end to end. The result must be safe to operate, economically viable, and compatible with the current system. Leave the working paths intact.
