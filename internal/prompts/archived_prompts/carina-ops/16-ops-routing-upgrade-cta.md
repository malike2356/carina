# Carina Ops Sprint 3.4: Ops routing and upgrade CTA

## Goal

Wire `/ops/*` static pages in the gateway and link from hosted chat UI with correct plan gating.

## Context

- Static files in `src/gateway/web/ops/` from prompt 14
- Router from prompt 15
- `web.ts` already serves `/billing`, `/settings` for hosted users

## Dependencies

- `14-ops-static-shell.md`
- `15-carina-ops-api-router.md`

## Files to modify

- `core.carinaai.uk/src/gateway/web.ts`
- `core.carinaai.uk/src/gateway/web-auth.ts`
- `core.carinaai.uk/src/gateway/web/hosted-login.html` (or post-login landing)
- `core.carinaai.uk/src/gateway/web/billing.html` (add Ops link)

## Step-by-step

1. In `web.ts` under hosted mode block, add routes:

```typescript
const OPS_STATIC = path.join(WEB_STATIC, 'ops');

app.get('/ops', requireHostedSession, requireOpsPlanGate, (_req, res) => {
  res.sendFile(path.join(OPS_STATIC, 'index.html'));
});

app.get('/ops/:page', requireHostedSession, opsPageHandler);
```

2. `opsPageHandler`:

- Free plan: serve `upgrade.html` for all `/ops/*` except `/ops/billing`
- Paid plan: serve matching `workbench.html`, etc.
- Unknown page: 404

3. Serve static assets:

```typescript
app.use('/ops/assets', express.static(path.join(OPS_STATIC)));
```

4. Add link on hosted home/billing:

```html
<a href="/ops/">Carina Ops</a>
```

Show only when `me.plan` is starter or team; otherwise show "Upgrade to Carina Ops".

5. `requireOpsPlanGate` middleware: redirect free users to `/ops/upgrade` or return upgrade HTML.

6. Add test in `web-auth.test.ts`:

- `/ops` is not public path
- `/api/carina-ops/health` remains public if configured

## Expected behavior

- Team user navigates to `https://app.carinaai.uk/ops/workbench`
- Free user sees upgrade page, not workbench data
- `ops.carinaai.uk` is never linked as customer entry point

## Test

Manual + `pnpm test src/gateway/web-auth.test.ts`

## Exit criteria

Sprint 3 complete: paid user opens `/ops` without ops.carinaai.uk credentials.
