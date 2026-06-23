# Prompt 26 - Playbook Page (Carina Cloud)

## Objective

Add `/playbook` to `app.carinaai.uk` so cloud users get situational path recommendations using workspace BYOK keys, constraints, and optional property domain plays.

This is the cloud counterpart to prompt 25. Not a hardware scanner primary UI (cloud users use APIs); focus on **task + constraints -> paths**.

---

## Context

**Working directory:** `app.carinaai.uk`

**Depends on:** Prompt 01 (chat/keys), Prompt 21 (core evaluate API)

---

## Step 1 - API proxy

`POST /api/playbook/evaluate`

1. Auth + workspace required
2. Forward to `core.carinaai.uk/api/playbook/evaluate` with:
   - `x-internal-key`
   - `workspaceId`
   - Merged capability map from workspace BYOK providers (no local GPU on cloud)

If core unreachable, run lightweight cloud-only fallback in `src/lib/playbook-fallback.ts` (path generator simplified, 3 paths max).

---

## Step 2 - UI `/playbook`

Match design system from prompt 00.

Sections:
1. **What do you need done?** (goal textarea)
2. **Constraints** (collapsible): PII toggle, budget, deadline, quality
3. **Property play** (optional): dropdown triggers (negotiation, due diligence, arrears) with dynamic input fields
4. **Run Playbook** -> results panel identical pattern to core (recommended + 4 paths)
5. **Actions per path:**
   - "Start chat with this plan" -> new session with path steps as system context
   - "Run research" (if path includes research step)
   - "Save to library" -> store playbook run in new table `playbook_runs`

---

## Step 3 - Schema

```ts
export const playbookRuns = pgTable('playbook_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  goal: text('goal').notNull(),
  recommendedPathId: text('recommended_path_id'),
  responseJson: jsonb('response_json').notNull(),
  chosenPathId: text('chosen_path_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

List recent runs at bottom of page.

---

## Step 4 - Sidebar

Add **Playbook** under Tools (book-open or route icon). Position after Research.

Remove any Cookbook link if present.

---

## Step 5 - Marketing copy

Subtitle on page:

"Situational plays for property, security, and ops. Not recipes; decisions with tradeoffs."

No chef/cooking metaphors in UI strings.

---

## Acceptance criteria

- [ ] `/playbook` returns 3-4 paths for sample property negotiation goal
- [ ] "Start chat with this plan" opens session with context
- [ ] Runs saved to `playbook_runs`
- [ ] Sidebar shows Playbook
