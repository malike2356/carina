# 08: Platform LLM defaults + OPS toggle hardening

**Status:** PENDING (mostly shipped; harden against drift)
**Priority:** P1
**Depends on:** 00
**Unlocks:** 09

## Goal

Platform AI stays on DeepSeek by default with Gemini (and others) switchable anytime from OPS. Env, DB `llm:platform`, and boot overlay cannot silently drift back to Gemini without an operator action in OPS.

## Why

Prod had `DEFAULT_PROVIDER=gemini` in docker runtime while trial Aiva was DeepSeek. Switches without UI make demos unpredictable. Founder wants DeepSeek default + OPS GUI switch.

## Already shipped (verify)

- Core `saveLlmRotationPlatformConfig` / `llm:platform` settings
- OPS `/ai-control?tab=models` and `/llm-providers`
- Prod set to DeepSeek `deepseek-chat` with Gemini still configured in rotation chain

## Requirements

1. Document operator runbook in this prompt's bottom section (and optionally OPS-KNOWLEDGE): how to switch DeepSeek ↔ Gemini in AI Control.
2. On Core boot after `applyLlmRotationSettingsFromDb`, prefer DB `DEFAULT_PROVIDER` over stale container env (already intended; add assertion/test if missing).
3. BYOK preference: do not change workspace BYOK choice without explicit product decision; platform default is separate.
4. Optional: OPS overview badge shows "Platform: deepseek/deepseek-chat" from live Core status.
5. Smoke: GET `/api/ops/llm-rotation` returns defaultProvider deepseek after boot unless OPS changed it.

## Operator runbook (include in OPS-KNOWLEDGE if editing)

1. Open `https://ops.carinaai.uk/ai-control?tab=models`
2. Set Carina platform provider + model
3. Save (posts Core `/api/ops/llm-rotation`)
4. Confirm status chain includes fallbacks if rotation enabled

## Acceptance criteria

- [ ] After recreate `carina-web`, default remains whatever DB last saved (not a forgotten env gemini).
- [ ] OPS UI still can switch to Gemini without deploy.
- [ ] Short note linked from OPS knowledge.

## Deploy

Only if code hardening required.
