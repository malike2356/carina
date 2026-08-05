## ADDENDUM; 2026-06-20: BUILD STATUS

**Overall: 0 FULLY BUILT, 3 PARTIALLY BUILT, 5 NOT BUILT (out of 8 prompts)**

This is the most under-built section. The theme is "Carina honesty"; ensuring what the agent says about itself matches reality.

### PARTIALLY BUILT

| Prompt | Built | Missing |
|--------|-------|---------|
| **P03 Cloud Chat Identity** | System prompt line 115-129 correctly states horizontal identity (not property-only). `carina-chat.ts` line 236 uses horizontal framing. | `cloud-identity.ts` module not created. No BYOK vs core-proxy mode block in prompt. `getCloudCapabilities()` not injected into cloud chat path. |
| **P06 Cloud UI Capability Badges** | `getCloudCapabilities()` exists with `webSearch`/`agentTools`/`chatMode` flags. | `CapabilityGate.tsx` does not exist. AppSidebar and CommandPalette do not import capabilities. Terminal, MCP, Cron, Files, Webhooks all visible regardless of plan. |
| **P07 Writing Style All Surfaces** | `sanitizeCarinaProse()` built and tested (46 lines). Applied in `prompt-guard-middleware.ts` for tool output and agent output scanning. | NOT applied in `orchestrator.ts` quickReply() or `carina-chat.ts` cloud stream. Three outbound paths still unsanitized. |

### NOT BUILT

| Prompt | What's Missing |
|--------|---------------|
| **P01 Surface Capability Contract** | `surface-capabilities.ts` missing entirely. `buildCapabilitySummaryLine()` still returns web nav labels for ALL platforms; no surface awareness. |
| **P02 Channel-Aware Quick Replies** | `quickReply()` stores `platform` field but ignores it. No channel-appropriate summaries. |
| **P04 Secret Refusal Output Guard** | `secret-refusal-guard.ts` missing. Only prompt-level refusal ("No." rule in system prompt). No mechanical scanner that detects "helpful refusals" leaking file existence or key names. |
| **P05 Memory + Tool Honesty** | `memory-status.ts` and `tool-status.ts` missing. `quickReply()` has no runtime checks for memory/tool state. |
| **P08 Capability Inventory CI Guard** | `identity-smoke.test.ts`, `capability-inventory-check.mjs`, `marketing-claim-check.mjs`; none exist. Marketing page still claims "40+ channels" with no runtime tie. |

**Priority: P01 (surface contract) is foundational; the rest build on it. P04 (secret refusal guard) is the highest security risk. P06 (UI badges) is highest user-facing gap.**
