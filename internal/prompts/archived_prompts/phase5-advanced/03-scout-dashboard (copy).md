# Action: Scout Dashboard 2.0 - This Product Already Exists, Map the Spec to It and Stop (Standalone Carina)

## Goal
Confirm that essentially everything this spec describes has already been built, as a separate, dedicated product (`console.labyrinthscout.com`, the "Labyrinth Scout" security control plane), and produce a mapping document showing which spec item maps to which already-complete feature - so nothing gets duplicated inside `core.carinaai.uk`. Identify the small handful of items that genuinely aren't covered yet, and route them to Scout's own prompt backlog, not into Carina.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **`06-scout-integration.md` (phase 1 of this batch) already established the headline finding**: "Scout Dashboard -> separate `console.labyrinthscout.com` product." This prompt confirms just how completely that separate product already delivers everything this spec asks for - to the point that **there is likely zero new code to write inside `core.carinaai.uk` as a result of this spec**.
- **Read `console.labyrinthscout.com/README.md`'s "Build status" table - it is, almost item for item, a checklist of this spec's requirements, all marked Complete**:

  | This spec asks for... | Already built as... |
  |---|---|
  | "Real-time monitoring... all active agents visible... live feed... color-coded threat levels" | `01-dashboard` + `13-dashboard-cinema` + `16/17-dashboard-full-rebuild/final`: SSE-streamed live feed, per-instance status, cinematic SOC-style dashboard, all Complete |
  | "Threat analytics... injection attempts... anomaly detection... trend lines... top attackers" | `09-anomaly-detector` (Z-score statistical baselines from 7 days of history) + `15-dashboard-charts` (donut/gauge/scatter/top-events/injection-overlay panels), Complete |
  | "Alert configuration... severity-based channel routing (telegram/email/sms)" | `08-alert-channels` (Telegram/Email/Slack dispatcher with Redis-deduplicated fan-out), Complete - note Slack instead of SMS; if SMS alerting is genuinely wanted, that's a small addition to an existing dispatcher, not a new system |
  | "Usage analytics... tokens per workspace... cost projection... local vs cloud ratio" | `15-dashboard-charts` includes a "provider pie" panel; cost/token analytics live where the actual LLM calls happen (`core.carinaai.uk`'s `01-model-routing.md`, this same batch) - Scout visualises security/operational events, Carina tracks its own spend; **do not build a second cost-tracking system here** |
  | "Compliance reporting... exportable audit reports (CSV/PDF)... custom report builder" | `23-export-audit-log` (`GET /api/export/events`, JSON/CSV, date-range/severity/instance filters, dashboard EXPORT dropdown), Complete - PDF export is the one sub-item not explicitly listed; a small addition to an existing exporter if genuinely wanted, not a new reporting system |
  | "Moving target deception... rotate prompt markers... decoy credentials" | **Not found in the build-status table** - this looks like the one substantively new idea in the whole spec |
  | "Behavioral baseline... learn normal patterns... self-tuning" | `09-anomaly-detector`'s "learns a statistical baseline of normal agent behaviour from 7 days of historical security events... flags sessions whose metrics deviate" - this is, functionally, exactly "behavioral baseline," Complete |
  | "Threat intelligence feed... subscribe to injection pattern databases... auto-update shield rules" | **Not found in the build-status table** - the second substantively new idea |
  | "Dashboard UI... agents table, live feed, attack trend bars" | `13`/`15`/`16`/`17` dashboard prompts, extensively iterated, Complete |
  | "Kill switch... block session... quarantine tool... rate limiting... honeypots" | `04-kill-switch`, `18-block-session`, `19-quarantine-tool`, `25-adjust-rate-limit`, `10`/`24-honeypot-manager/add-honeypot` - all Complete, and all already verified end-to-end from Carina's side in `06-scout-integration.md` |

- **The pattern here is structurally different from every other "reinterpret/scope-cut" prompt in this batch**: this isn't a spec for a different product's catalog that needs translation - it's a spec for a product that VERLOX has *already built, in this very monorepo*, just under a different name and directory than the spec assumed. The honest, correct action is "stop, point at the existing thing, identify the 2 real gaps."

## Files to create
None inside `core.carinaai.uk`. If the two genuinely-new items below are wanted, they belong as new numbered prompts in `console.labyrinthscout.com/prompts/` (the next number after `26-clear-session-memory` would be `27-...`), to be planned and built as part of THAT product's roadmap - not as a phase-5 Carina deliverable.

## Step-by-step

1. Read `console.labyrinthscout.com/README.md`'s build-status table and spot-check 3-4 of the referenced prompt files (`08-alert-channels.md`, `09-anomaly-detector.md`, `23-export-audit-log.md` are good ones - each maps directly onto a named spec section) to confirm the mapping above is accurate and not just plausible-looking from filenames. Note any discrepancy you find (a "Complete" item that's actually partial, or a feature that reads differently in the prompt than the README summary suggests).

2. Produce the mapping table above as your primary deliverable - a clear "spec section -> existing feature -> status" document the user can hand to anyone asking "do we need to build a Scout Dashboard 2.0." Put it in your completion summary; don't create a new doc file unless the user asks for one to be kept (per the standing "don't create planning/analysis documents unless asked" guidance).

3. **Investigate the two apparent gaps before assuming they're worth building**:
   - "Moving target deception" (rotating system-prompt markers, randomising tool names in instructions, injecting decoy credentials that alert on leakage): this is a genuinely interesting idea, but also genuinely unusual - rotating tool names in system instructions risks confusing the agent's own tool-selection (an LLM that's told the file-read tool is called `xq7z_reader` this hour and `m2k_loader` next hour may simply get worse at using its own tools, for a security benefit that's speculative). Decoy credentials that alert on leakage is the most concretely valuable sub-idea here - it's a honeypot variant, and Scout already has a working `honeypot-manager` (`10`/`24`). Consider whether "decoy credentials as a honeypot type" is a small extension to the EXISTING honeypot system rather than a new "deception" subsystem.
   - "Threat intelligence feed" (subscribing to community injection-pattern databases, auto-updating shield rules): this requires picking a real external feed/format to subscribe to (the spec names none) and a trust model for "auto-updating security rules from a third party" that deserves real scrutiny - an attacker who can poison a "community threat signature" feed could use it to make a target's own defences malfunction. This is a substantial, security-sensitive feature that needs its own properly-scoped design discussion, not a paragraph in a ported spec.

4. For each of the two gaps, write a short note (not a full spec) describing what it would take and what the open questions are, and ask the user whether either is worth a real, dedicated Scout prompt - phrased so they can say "neither, skip it" without friction (these are genuinely optional hardening ideas, not core product gaps).

5. Confirm with a quick look at `06-scout-integration.md` (this batch's earlier deliverable) that nothing in ITS verification plan overlaps with or contradicts what you find here - it should be complementary (that prompt verified Carina's SIDE of the integration; this one confirms Scout's dashboard-and-analytics side is already complete).

## Expected behavior
- The user has a one-glance answer to "do we need to build Scout Dashboard 2.0": no, it's already built, here's the proof, here's the mapping, here are the two optional ideas worth a nod either way.
- No duplicate dashboard, alert dispatcher, anomaly detector, or export endpoint gets built inside `core.carinaai.uk`.
- If "decoy credentials as honeypots" or "threat intel feed" get a thumbs-up, they're queued as Scout prompts (`27-...`, `28-...`) for that product's own roadmap - properly scoped, security-reviewed, and sequenced against Scout's existing `honeypot-manager`/`prompt-guard` infrastructure, not bolted onto Carina.

## Test
N/A for code (none is being written here). Verification is the mapping-table cross-check in step 1: open the referenced Scout prompt files and confirm each spec section genuinely has a complete, working counterpart.

## Dependencies
- `06-scout-integration.md` (this batch) - confirms Carina's side of the Scout relationship is wired correctly; this prompt confirms Scout's dashboard side independently
- User sign-off on whether either of the two genuinely-new ideas (decoy-credential honeypots, threat-intel feed) is worth pursuing as a future Scout prompt
