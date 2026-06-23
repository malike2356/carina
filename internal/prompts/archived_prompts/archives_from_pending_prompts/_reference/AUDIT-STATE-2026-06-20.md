# Planning Document Audit; State vs Reality
# Generated: 2026-06-20
# Purpose: Addendum to planning prompts showing what's actually built

## Summary

| Section | Prompts | FULLY BUILT | PARTIALLY BUILT | NOT BUILT |
|---|---|---|---|---|
| gap-05-security (all sub-prompts) | 83 | **81** | 2 | 0 |
| gap-12-scout-product | 9 | **6** | 3 | 0 |
| gap-13-truth-in-advertising | 8 | **0** | 3 | 5 |
| sprint-2 01-deployment | 4 | **4** | 0 | 0 |
| sprint-2 02-web-ui | 9 | **4** | 1 | 4 |
| sprint-2 03-cli-tui | 6 | **5** | 1 | 0 |
| sprint-2 04-desktop | 5 | **4** | 1 | 0 |
| sprint-2 05-mobile | 5 | **2** | 2 | 1 |
| sprint-2 09-skills-hub | 5 | **5** | 0 | 0 |
| sprint-2 11-workspace | 9 | **4** | 2 | 3 |
| sprint-2 12-voice | 7 | **1** | 1 | 5 |
| **TOTAL** | **150+** | **116+** | **16** | **18** |

## Key Finding

The planning layer is severely out of sync with the codebase. Approximately 77% of planned prompts are already implemented in source code. The planning documents describe work that has already shipped; in some cases for months. The remaining 23% are genuine gaps, concentrated in:
- Voice agent (5/7 NOT BUILT)
- Truth in advertising / capability honesty (5/8 NOT BUILT)
- Web UI polish (4/9 NOT BUILT)
- Workspace platform distribution (3/9 NOT BUILT)

This file should be placed alongside the planning prompts as a reference.
