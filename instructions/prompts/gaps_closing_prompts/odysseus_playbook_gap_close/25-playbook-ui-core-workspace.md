# Prompt 25 - Playbook Workspace UI (Core)

## Objective

Replace `/cookbook` in core web workspace with `/playbook`: situational decision UI + hardware capability panel. User-facing name is **Playbook** everywhere.

---

## Context

**Working directory:** `core.carinaai.uk/packages/web`

**Depends on:** Prompt 21 minimum (path generator)

**Files to inspect:**
- `packages/web/src/workspace-chrome.ts` (cookbook nav entry)
- `packages/web/src/web-server.ts` (routes)
- `src/api/cookbook-api.ts`

---

## Step 1 - Route migration

- Add `GET /playbook` serving `playbook.html` or SPA section
- `GET /cookbook` -> 302 to `/playbook?tab=hardware`
- Update `workspace-chrome.ts`: label **Playbook**, href `/playbook`, description "Situational decisions and model capability"

---

## Step 2 - Playbook page layout

Two-column layout:

**Left: Situation form**
- Goal (textarea)
- Quick constraint chips: PII, Offline, Budget, Deadline
- Advanced: budget amount, deadline datetime, quality minimum
- Domain play trigger dropdown (optional, lists from `carina playbook plays`)
- Run Playbook button

**Right: Results**
- Recommended path card (green border)
- 4 path cards with score bars
- Reasoning bullet list
- Risks callout
- Execute button (calls API with confirm modal)
- Copy as markdown

**Tab: Hardware** (sub-tab or `?tab=hardware`)
- Existing cookbook hardware scan + top 5 models (from cookbook API)
- Label: "Capability map" not "Cookbook"

---

## Step 3 - API

`POST /api/playbook/evaluate`
```json
{ "goal": "...", "constraints": {}, "trigger": null, "inputs": {} }
```
Returns `PlaybookResponse` JSON.

`GET /api/playbook/plays?domain=property`

Reuse internal playbook modules from prompt 20-21.

---

## Step 4 - Assets

- `packages/web/assets/web/playbook.js` client logic
- Styles match workspace shell (teal accent, Inter)

Remove "cookbook" string from visible HTML (keep in code comments referencing internal module only).

---

## Step 5 - Tests

- `workspace-chrome.test.ts`: nav shows Playbook not Cookbook
- API evaluate returns 4 paths for sample goal

---

## Acceptance criteria

- [ ] `/playbook` loads in operator and hosted BYOK mode
- [ ] `/cookbook` redirects
- [ ] Hardware tab shows model recommendations
- [ ] Situation form returns scored paths with reasoning
