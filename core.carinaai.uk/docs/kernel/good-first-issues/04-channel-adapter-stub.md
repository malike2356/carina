---
title: "feat: document channel adapter interface with IRC stub example"
labels:
  - good first issue
  - channel
---

## Context

Carina supports 18+ channel adapters under `src/gateway/channels/`. The interface is defined in `src/gateway/channels/channel-adapter.interface.ts`. An **IRC stub adapter** already exists at `src/gateway/channels/adapters/irc-adapter.ts` (webhook-based; enable with `IRC_ENABLED=true`). There is no developer doc explaining how to implement a new adapter.

## Task

Write developer documentation for the channel adapter pattern, using the IRC stub as the worked example.

## Files to create

- `docs.carinaai.uk/docs/developer/gateway/channel-adapter.md`

## Files to modify

- `docs.carinaai.uk/sidebars.ts` (add under Gateway section)
- Optionally `src/gateway/channels/adapters/irc-adapter.ts` (expand file-level comment with env vars and webhook payload shape)

## Doc outline

1. **What is a channel adapter** - implements `IChannelAdapter`
2. **Required methods** - `parseInbound`, `sendMessage`, `formatForChannel`
3. **Optional methods** - `validateWebhook`, `createRouter`, `start`
4. **Registration** - how adapters are wired in `channel-registry.ts`
5. **IRC stub walkthrough** - sidecar pattern, `IRC_ENABLED`, example webhook JSON
6. **Testing** - point to `irc-adapter.test.ts` and `channel-registry.test.ts`

Do not implement a live IRC client in core; the stub is intentional.

## Acceptance criteria

- [ ] New doc page builds in Docusaurus
- [ ] Doc references `IChannelAdapter` and IRC stub paths accurately
- [ ] Doc states Scout is separate (channel docs are kernel-scoped)
- [ ] Sidebar link under Developer > Gateway

## Test

```bash
cd docs.carinaai.uk && pnpm build
grep -i "IChannelAdapter\|irc" docs/developer/gateway/channel-adapter.md
```
