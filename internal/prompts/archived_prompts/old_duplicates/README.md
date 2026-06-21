# _archive-duplicates; Why This Exists and What to Do With It

**Created:** 2026-06-18  
**Reason:** De-duplication and restructuring of Carina upgrade prompts

Reuse rule: archived prompts are reference material only. If you use detail from an archived prompt, rewrite the wording in Carina voice before shipping it.

---

## Why These Are Here

During the gap analysis, the Carina upgrade prompts were restructured from a flat, overlapping set into 8 clean, non-overlapping gaps. The prompts in this directory are the **superseded versions**; they were replaced by more complete, more detailed, or better-scoped versions in the numbered `gap-0X-*/` directories above.

**These were NOT deleted because:**
They contain implementation details, architecture notes, and reference paths that may still be useful during actual development. Some archived prompts have different code-level specifics than their replacements; a dev comparing both may find useful detail that the replacement abstracted away.

---

## Archive → Active Mapping

| Archived | Replaced By | Why Replaced |
|---|---|---|
| `gap-01-desktop-app/prompt.md` (561 lines) | `gap-04-desktop/` (3 files) | Weaker scope; single monolithic prompt vs. split into scaffold + chat engine + README. The archived version has detailed UI component specs (561 lines of component-by-component layout) not in the replacement. **Worth reading during desktop build.** |
| `gap-01-docker-supervision/prompt.md` (245 lines) | `gap-01-docker/prompt.md` (479 lines) | Simpler approach; adds supervisor configs to existing Dockerfile. Replacement is the full s6-overlay migration. The archived version is the **fast path** (2-3 days) documented as "Option A" in the replacement. Use this if you need a quick supervisor fix instead of a full s6 migration. |
| `gap-02-native-mobile/prompt.md` (408 lines) | `gap-03-mobile/` (3 files) | Monolithic; 18 features in one file. Replacement splits into background-connection + camera-motion with README. The archived version covers **more sensors** (contacts, calendar, SMS, notification relay, photos, system handler) that the replacement doesn't detail. **Read during mobile sensor work.** |
| `gap-02-native-mobile/prompt-native-modules.md` (228 lines) | `gap-03-mobile/` | Native module companion; contains Kotlin/Swift native module specs (ConnectionService, NotificationListener, SMS, Motion, Camera frames, Secure Enclave, Pairing). The replacement is Expo-focused. **Essential for native Android/iOS development**; this is likely NOT in the replacement. |
| `gap-03-skill-hub/prompt.md` (240 lines) | `gap-02-carina-hub/` (5 files) | Single file covering everything vs. 5 prompts split into security scanner, reviews, website, CLI, deployment. The archived version documents the codebase state (90% backend built, what's in `src/skills/hub/`) with more granularity than the replacement. **Read for codebase context before building.** |
| `gap-05-webui-upgrade/README.md` (50 lines) | `gap-06-webui/` (8+ prompts) | Stub; just a README with a table of contents. The replacement has actual prompt files. The archive has **prompt-to-agent assignments** and hour estimates that differ from the replacement. **Check agent assignments against current team capacity.** |
| `gap-06-tui-cli/README.md` (146 lines) + `gap-06-tui-cli/01-ink-chat-tui.md` (446 lines) | `gap-07-tui-cli/` (3 files) | The archived Ink chat TUI prompt is a full 446-line spec with component-by-component implementation. The replacement includes this plus GOLD-STANDARD-TUI-CLI.md and GOLD-STANDARD-ONBOARDING-AESTHETICS.md. The archived version has **detailed React/Ink component code** (complete app.tsx, all 10 components, transport layer) that the replacement may summarize. **Read alongside gap-07 during TUI build.** |

---

## How to Use This Archive

### Before Implementing Any Gap

1. **Read the active prompt** in the numbered gap directory first; that's the canonical spec.
2. **Then read the archived version** (if one exists for that gap); look for:
   - Code snippets or implementation details the active version abstracted
   - Reference file paths that might have changed
   - Different agent assignments or time estimates
   - Edge cases or pitfalls mentioned only in the archived version

### During Implementation

If you hit a dead end in the active prompt, check the archived version. It may have:
- A different architectural approach (e.g., docker-supervision vs s6-overlay)
- Lower-level implementation details
- More granular file paths and line numbers

### After Implementation

Once a gap is fully implemented and the code is in production:
- Compare the archived prompt against what was actually built
- If the archived version contains nothing beyond what the active version covers → safe to delete
- If the archived version has useful reference paths, architecture notes, or alternative approaches that proved valuable → consider merging that content into the active prompt, then delete the archive

---

## When to Delete

Delete individual archived directories when:
1. The corresponding gap is fully implemented in production
2. You've confirmed the active prompt covers everything the archived version had
3. No alternative approaches in the archive were useful during development

Delete the entire `_archive-duplicates/` directory when:
- All 6 archived gaps have been implemented
- A final comparison pass confirmed nothing of value remains

**Do NOT delete before implementation starts**; devs may need the archived detail.

---

## Quick Reference: File Sizes

```
_garchive-duplicates/
├── gap-01-desktop-app/prompt.md              (561 lines, ~19KB)  → gap-04-desktop/
├── gap-01-docker-supervision/prompt.md        (245 lines, ~8KB)   → gap-01-docker/
├── gap-02-native-mobile/prompt.md             (408 lines, ~13KB)  → gap-03-mobile/
├── gap-02-native-mobile/prompt-native-modules.md (228 lines, ~7KB) → gap-03-mobile/
├── gap-03-skill-hub/prompt.md                 (240 lines, ~9KB)   → gap-02-carina-hub/
├── gap-05-webui-upgrade/README.md             (50 lines, ~2KB)    → gap-06-webui/
├── gap-06-tui-cli/README.md                   (146 lines, ~6KB)   → gap-07-tui-cli/
└── gap-06-tui-cli/01-ink-chat-tui.md          (446 lines, ~15KB)  → gap-07-tui-cli/

Total: 2,324 lines, ~79KB of still-potentially-useful content
```

---

## What Was NOT Archived

The `gap-07-enterprise-security` directory was empty (no prompts written). It was removed entirely during restructuring. Enterprise security is now covered by `gap-08-enterprise-security/` (7 prompts: SSO, audit, residency, DR, zero-trust, SOC2).

Other gaps (05-security with its 72 cyber tools, 08-enterprise-security) were created fresh during restructuring and have no archived predecessors.
