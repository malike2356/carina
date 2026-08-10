# Aiva routing and quality baseline

Status: Prompt 801 implementation baseline

This is a safe pre-production baseline. No production request identifiers, prompt text, secrets, credentials, or personal content are included.

## Current observation

The current repository can describe selected routing and provider observations, but a real production request was not supplied to this report. Therefore engine and model execution are recorded as `not_observed`, not inferred from configuration.

## Required evidence for a real turn

- tenant, workspace, worker, contact, conversation, channel, and consent identifiers
- selected engine, provider, model, tier, policy, and policy source
- verified provider and model that actually executed inference
- Keprix or Carina handling status and explicit fallback reason
- prompt and context budgets, memory sources, tool rounds, tools, retries, latency, token usage, and error class
- owner, employee, public customer, and audience-principal routing differences
- silent failure paths requiring remediation

## Implemented baseline contract

`src/benchmark/aiva-routing-baseline.ts` provides a machine-readable schema, a human-readable renderer, safe `not_observed` values, and an execution verification rule. A selected provider is never reported as having handled a turn unless the observed execution provider matches it.

The baseline writer stores runtime evidence under the configured Carina evaluation directory as `aiva-routing-baseline-801.json` and `aiva-routing-baseline-801.md`.
