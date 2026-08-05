# Scout channel kill build checklist

**Updated:** 2026-07-28

This checklist converts the prompt map into the build sequence I will follow in code.

## Phase 1; prompt 01

- [ ] Add `channel_operator_links` migration
- [ ] Add `channel_control_events` migration
- [ ] Add `organization_id` support where the engine needs it for org-wide control
- [ ] Create `src/messaging/control.ts` as the shared control service
- [ ] Add `src/api/internal/control.ts` with `X-Scout-Internal-Key` auth
- [ ] Mount the internal control router in `src/server.ts`
- [ ] Rewire current admin kill and resume paths onto the shared service
- [ ] Add unit tests for the shared control service
- [ ] Add HTTP tests for the internal control router

## Phase 2; prompt 02

- [ ] Add Telegram inbound control webhook
- [ ] Add confirm flow for kill, freeze, and restrict
- [ ] Add Telegram link lookup against `channel_operator_links`
- [ ] Add Telegram webhook tests

## Phase 3; prompt 03

- [ ] Add dashboard channel-linking API
- [ ] Add channel-linking UI
- [ ] Add panic mode setting
- [ ] Add dashboard tests for link, revoke, and settings

## Phase 4; prompt 04

- [ ] Add WhatsApp inbound control webhook
- [ ] Add WhatsApp confirm flow
- [ ] Add WhatsApp webhook tests

## Phase 5; prompt 05

- [ ] Add e2e script for link, kill, confirm, and resume
- [ ] Update Scout docs and sales claims
- [ ] Archive the prompt pack after completion

