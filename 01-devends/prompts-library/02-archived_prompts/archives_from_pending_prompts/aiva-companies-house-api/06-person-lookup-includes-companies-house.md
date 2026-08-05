# 06: Person lookup always includes Companies House

**Status:** PENDING (partially shipped in Core mandatory routing)
**Priority:** P0
**Depends on:** 02, 04
**Unlocks:** natural "find [person]" UX everywhere

## Goal

When an owner asks Aiva to find a person (Contacts, workspace, "everywhere"), Aiva **also** searches Companies House officers with the same name and reports both sources. Contacts alone is not enough.

## Why

Owner expectation: "find me a person" / APR / anyone in Contacts or the workspace should also check the UK register for officer matches. Companies House is a first-class person source, not only an explicit "Companies House" ask.

## Requirements

1. `workspace_contacts_fast` mandatory rule includes `contacts` + `companies-house-search-officers`.
2. `workspace_contacts` escalation includes CH officer (+ get/list when deepening).
3. `aiva-process-message` system guidance: labelled sections Contacts vs Companies House; do not stop after empty Contacts if CH has hits.
4. If CH grant/key missing: still answer Contacts; honest skip + Tools CTA for Companies House.
5. Never invent officer matches. CH does not return marketing emails.
6. Vitest: `find ayeke` / `who is X` require both tool names in `primaryMandatoryTools`.
7. OPS: active workers granted `companies-house`; Contabo has `COMPANIES_HOUSE_API_KEY` from Carina Hub app (not the Keprix default unless intentional).

## Acceptance criteria

- [x] "find Jane Smith" runs Contacts search and `companies-house-search-officers` (mandatory routing + Vitest).
- [x] Reply guidance: separate Contacts vs Companies House sections (`aiva-process-message`).
- [x] Contabo: `COMPANIES_HOUSE_API_KEY` present (Carina Hub app); officer search HTTP 200 from carina-web.
- [x] Active workers granted `companies-house` connected.
- [ ] Owner chat smoke: labelled CH section appears on a real find-person turn.

## Files

- `src/tools/mandatory-tools.ts`
- `src/workers/aiva-process-message.ts`
- `src/tools/mandatory-tools.test.ts`
- Deploy `carina-web` after change
