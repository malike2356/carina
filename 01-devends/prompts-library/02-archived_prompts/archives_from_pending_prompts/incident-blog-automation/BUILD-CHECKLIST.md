# Incident blog automation build checklist

**Updated:** 2026-07-28

## Phase 1; discovery

- [x] Audit the current web search queries and curation rules
- [x] Add broader incident discovery coverage for current AI agent and model misuse news
- [x] Make discovery resilient to query misses and source noise

## Phase 2; source quality

- [x] Strengthen source validation for titles, dates, companies, and damage
- [x] Require primary source URLs and deduplication by canonical URL
- [x] Reject trend reports and generic commentary unless they clearly support the claim

## Phase 3; approval policy

- [x] Add configurable auto-approve thresholds
- [x] Add optional auto-publish behavior for high confidence items
- [x] Keep manual review for ambiguous or weakly sourced items

## Phase 4; subscriber dispatch

- [x] Wire publish events to newsletter delivery
- [x] Add optional digest mode for daily or weekly summaries
- [x] Keep confirmed subscribers only and preserve unsubscribe handling

## Phase 5; admin controls

- [x] Add settings for research frequency, confidence thresholds, publish mode, and newsletter mode
- [x] Expose recent research runs, draft counts, and newsletter delivery stats
- [x] Keep ops controls easy to review and change

## Phase 6; regression

- [x] Verify new incidents are discovered from current news
- [x] Verify drafts stay source-backed
- [x] Verify auto-approve rules do not bypass source quality
- [x] Verify newsletters only send to confirmed subscribers
- [x] Verify publish and send behavior is logged
