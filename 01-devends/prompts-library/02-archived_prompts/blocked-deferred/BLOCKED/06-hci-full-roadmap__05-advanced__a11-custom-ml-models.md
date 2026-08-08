# Custom Fine-tuned Medical/Cultural Models

**Roadmap tier:** Advanced to have
**Prompt ID:** A11
**Priority:** P2
**Depends on:** funding
**Target time:** multi-week
**Primary paths:** `ml/, docs/`
**Outline coverage:** Advanced: Custom ML models

## Strategic intent

Fine-tuned models for medical/cultural HCI.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

Generic LLMs miss domain nuance.

## Required deliverables

- Training data governance
- Model registry plan
- Serving via sidecar contract
- Evaluation harness

## Implementation notes

- Do not train until funding/data lawful basis

## Files to create or change

- docs/ml/plan.md

## Acceptance criteria

1. Eval harness runs baseline vs candidate

## Tests and validation

- Offline eval

## Demo / sales proof

Show eval scorecard.

## Out of scope for this prompt

Full Triton/MLflow/Feast platform.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `A11`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
