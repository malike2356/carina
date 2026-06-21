# Carina Ops demo seed (sales calls)

Instructions to create a demo org with sample usage, audit, and workbench history. **Do not commit real API keys.**

Run against staging or local hosted stack with `HOSTED_MODE=true` and migrations applied.

## 1. Create demo user

Use ops panel **Create tenant** or register at `/hosted-register` with a demo email you control.

Suggested labels:

- Email: `demo-ops@yourcompany.example`
- Org name: `Acme Ops Demo`
- Plan: assign **carina_ops_team** manually or complete Stripe test checkout

## 2. Add BYOK (staging keys only)

In `/ops/vault`, add a **test** provider key (OpenAI or DeepSeek test key). Never use production keys in shared demo orgs.

## 3. Seed workbench run

In `/ops/workbench`, run a short prompt, for example:

```text
Summarise three benefits of BYOK for platform teams in two sentences.
```

Confirm a row appears under workbench runs and in Usage.

## 4. Seed audit variety

Perform one action from each area so the audit tab looks realistic:

- Vault save (already done)
- Workbench run (already done)
- Settings invite (create pending invite to a fake email)
- Billing page visit (optional; triggers billing summary load)

## 5. Optional SQL seed (advanced)

If you need bulk history without clicking, insert org-scoped rows on staging only:

```sql
-- Replace :org_id and :tenant_id with demo org values
INSERT INTO product_audit_log (org_id, action, resource_type, details)
VALUES
  (:org_id, 'billing.trial_started', 'subscription', '{"trialDays":14}'),
  (:org_id, 'usage.viewed', 'usage', '{}');

INSERT INTO usage_records (org_id, tenant_id, date, model, tokens_used, cost_estimate)
VALUES
  (:org_id, :tenant_id, CURRENT_DATE, 'openai/gpt-4o-mini', 1200, 0.0024),
  (:org_id, :tenant_id, CURRENT_DATE - 1, 'anthropic/claude-sonnet', 800, 0.004);
```

Verify org scoping: all rows must use the same `org_id`.

## 6. Demo script (5 minutes)

1. Show onboarding wizard or overview metrics.
2. Vault: provider connected, no key material visible.
3. Workbench: live prompt run.
4. Usage: monthly tokens and credits.
5. Audit: recent events; Team CSV export.
6. Billing: plan and trial days left.

## Cleanup

After the call, revoke demo invites and rotate or remove BYOK keys. Suspend demo tenant in ops panel if no longer needed.
