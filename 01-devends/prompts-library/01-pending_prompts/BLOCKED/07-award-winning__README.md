# Clinicom Award-Winning Build Prompts (Phase 07)

**Created:** 2026-08-02  
**Updated:** 2026-08-04 (W01-W10 archived)  
**Source:** Internal award-winning advice plan (must / nice / amplify / deferred)  
**Root:** `carina/01-devends/prompts-library/01-pending_prompts/07-award-winning/`  
**Archived Must:** `02-archived_prompts/archives_from_pending_prompts/07-award-winning/01-must/`

These prompts are thorough implementation briefs for agents. They assume Clinicom already ships marketing, interpreter `/app`, practice dashboard, embed, and a wide HCI/compliance scaffold. Goal: turn that into award and Trust credible product. Must (W*) is archived; remaining work is Nice, Amplify, and owner-blocked Deferred.

## How to use

1. Pick one prompt ID from the tables below.
2. Open the markdown file and execute it end to end.
3. Respect Context blocks (Stripe SoT, writing style, claim firewall, no nested `carina/verlox/`).
4. Update this README status column when done.
5. Must (W*) is archived. Work Nice (N*), Amplify (AMP*), then Deferred (D*) when unblocked.

## Status legend

| Status | Meaning |
|---|---|
| `pending` | Not started |
| `in_progress` | Actively coding |
| `partial` | Shipped subset; gaps remain |
| `done` | Acceptance criteria met + tests |
| `blocked-owner` | Needs owner decision, money, or external contract |

## 90-day mapping

| Window | Prompt IDs |
|---|---|
| Days 1-30 | W03, W04, W05, W10, W06, W07, W02, W09 |
| Days 31-60 | W08, N02, W05 Easy Read link, AMP01-AMP03, AMP06 |
| Days 61-90 | N01, N09, N10, N05, N14, AMP05 |
| When unblocked | D01-D04, N11, N12, N13 |

## Must have (W01-W10) - ARCHIVED 2026-08-04

All W* prompts live under `archives_from_pending_prompts/07-award-winning/01-must/`. Do not re-implement.

| ID | Archive file | Status | Priority |
|---|---|---|---|
| W01 | `w01-clinical-safety-closure-path.md` | done (archived) | P0 |
| W02 | `w02-clinicom-native-stripe-catalog.md` | done (archived) | P0 |
| W03 | `w03-encounter-record-integrity.md` | done (archived) | P0 |
| W04 | `w04-clinician-authorship-accept-edit-reject.md` | done (archived) | P0 |
| W05 | `w05-structured-ehr-ready-handoff.md` | done (archived) | P0 |
| W06 | `w06-wcag-aa-evidence-pack.md` | done (archived) | P0 |
| W07 | `w07-trust-share-pack-dpia-dspt.md` | done (archived) | P0 |
| W08 | `w08-pilot-outcome-measurement.md` | done (archived) | P0 |
| W09 | `w09-production-auth-resilience.md` | done (archived) | P0 |
| W10 | `w10-hard-claim-firewall.md` | done (archived) | P0 |

## Nice to have (N01-N14)

| ID | File | Status | Priority |
|---|---|---|---|
| N01 | `02-nice/n01-specialty-packs-measured-lift.md` | partial | P1 |
| N02 | `02-nice/n02-pharmacy-reception-polish-kits.md` | partial | P1 |
| N03 | `02-nice/n03-family-conference-facilitator.md` | pending | P1 |
| N04 | `02-nice/n04-indoor-wayfinding-easy-read.md` | pending | P2 |
| N05 | `02-nice/n05-certified-bsl-partner-path.md` | pending | P1 |
| N06 | `02-nice/n06-realtime-confidence-coaching.md` | pending | P1 |
| N07 | `02-nice/n07-ambient-room-mode.md` | pending | P2 |
| N08 | `02-nice/n08-offline-encounter-queue.md` | pending | P1 |
| N09 | `02-nice/n09-pcn-multisite-hci-rollup.md` | pending | P1 |
| N10 | `02-nice/n10-developer-golden-transcript-sandbox.md` | partial | P1 |
| N11 | `02-nice/n11-aiva-nurse-manager-bridge.md` | pending | P2 |
| N12 | `02-nice/n12-custom-ml-eval-to-pilot.md` | pending | P2 |
| N13 | `02-nice/n13-helm-microservices-readiness.md` | pending | P3 |
| N14 | `02-nice/n14-award-film-media-pipeline.md` | pending | P2 |

## Amplify existing strengths (AMP01-AMP06)

Do not rebuild these from zero. Deepen what already differentiates Clinicom.

| ID | File | Status | Priority |
|---|---|---|---|
| AMP01 | `03-amplify/amp01-teachback-loop-closure.md` | partial | P1 |
| AMP02 | `03-amplify/amp02-consent-ritual.md` | partial | P1 |
| AMP03 | `03-amplify/amp03-safety-ack-theatre.md` | partial | P1 |
| AMP04 | `03-amplify/amp04-cultural-notes-quality.md` | partial | P2 |
| AMP05 | `03-amplify/amp05-continuity-failover-demo.md` | partial | P1 |
| AMP06 | `03-amplify/amp06-riverside-story-spine.md` | partial | P1 |

## Deferred / contract-gated (D01-D04)

Code scaffolds and honesty labels only until owner unblocks.

| ID | File | Status | Priority |
|---|---|---|---|
| D01 | `04-deferred-contract/d01-live-trust-fhir-writeback.md` | blocked-owner | P0 when unblocked |
| D02 | `04-deferred-contract/d02-live-nhs-cis-login.md` | blocked-owner | P0 when unblocked |
| D03 | `04-deferred-contract/d03-external-dtac-dcb-audit.md` | blocked-owner | P0 when unblocked |
| D04 | `04-deferred-contract/d04-live-enterprise-sso-federation.md` | blocked-owner | P1 when unblocked |

## Overlaps with older pending HCI / phases

| Older ID | Award prompt to prefer / extend |
|---|---|
| M06 Stripe | W02 |
| M19 Google OAuth | W09 |
| A04 / #22 FHIR | D01 (+ W05 stub) |
| A05 / #23 CIS | D02 |
| A07 / #34 audit | D03 (+ W01 internal pack) |
| A11 / #32 ML | N12 |
| A14 / #33 federation SSO | D04 |
| A16 Aiva | N11 |

## Prompt count

| Bucket | Count |
|---|---|
| Must (archived) | 10 |
| Nice (open) | 14 |
| Amplify (open) | 6 |
| Deferred (open) | 4 |
| **Open total** | **24** |

## Award rubric coverage

| Rubric area | Primary prompts |
|---|---|
| Clinical and safety | W01, W04, W05, AMP03, D03 |
| NHS / procurement | W02, W07, W09, W10, D01, D02, D04 |
| Human communication UX | W03, W06, AMP01, AMP02, AMP04, N02, N03, N05, N06 |
| Product craft | W03, W05, N07, N08, AMP06, N14 |
| Evidence / outcomes | W08, N01, N09, N10, AMP05, N12 |
