# Hosted multi-tenant SaaS - build plan (app.carinaai.uk)

**Status: WIRED (2026-06-12). Track 1 (operator gate) and Track 2 (hosted auth, quota, billing routes) are live behind `HOSTED_MODE=true`. See `src/api/hosted.ts`, `hosted-auth.ts`, `hosted-billing.ts`, and `src/gateway/hosted-chat.ts`.**

## Why this document exists

`core.carinaai.uk` was found running publicly with zero auth on its chat routes - anyone could
burn the operator's LLM budget for free. That has been fixed (Track 1, done 2026-06-07): the
whole web UI now sits behind a single-password gate (`CARINA_WEB_PASSWORD`, see
`src/gateway/web-auth.ts` and `src/gateway/web.ts`). `core.carinaai.uk` is now the operator's
**private** instance. Nobody else gets in.

The user's direction: people who want their own Carina should self-host it (download from
carinaai.uk and run it themselves). If the operator wants to *also* offer a hosted product where
strangers sign up and use Carina through a browser - "like ChatGPT or Claude" - that requires
real multi-tenancy: every user has their own login, their own conversation history, and a quota
or subscription that stops them burning the operator's API budget.

**The good news:** ~80% of that already exists and is unused. `src/api/hosted-auth.ts` and
`src/api/hosted.ts` (310 lines) already implement register/login/JWT/API-keys/tiers/quota/Stripe.
It is gated behind `HOSTED_MODE=true` and is mounted on hosted chat routes (`checkHostedQuota` runs in `src/gateway/hosted-chat.ts` before agent turns).

## Key architectural decision: one process, two domains, Host-aware gate

`docker/nginx/carina-prod.conf` already proxies **both** `core.carinaai.uk` and
`app.carinaai.uk` to the same upstream (`127.0.0.1:3000`). That was the original plan, and it's
still the right one - one Node process, one deploy, one supervisor entry. But it means the
single-password gate just added for `core.carinaai.uk` would, unmodified, also block real
customers from `app.carinaai.uk`.

So the gate must become **Host-aware**:

- `Host: core.carinaai.uk` (and any other internal host) -> operator gate, `CARINA_WEB_PASSWORD`,
  exactly what exists today in `web-auth.ts`. One user: the operator.
- `Host: app.carinaai.uk` -> hosted multi-tenant gate. Each visitor registers/logs in with their
  own email+password (or JWT/API key for programmatic use), gets their own isolated chat history,
  their own tier (`free`/`pro`), and is metered against `checkHostedQuota`.

This keeps "my private Carina" and "the SaaS product" cleanly separated while still being one
deployable artifact. Do not stand up a second process or a second codebase for this.

---

## Prompt 1 - Host-aware gate + hosted login/register UI

**Working directory:** `core.carinaai.uk/`

### What to build

1. In `src/gateway/web-auth.ts`, change `requireWebAuth` and `redirectIfWebAuthed` to branch on
   `req.hostname` (Express populates this from the `Host` header / `X-Forwarded-Host` since
   `app.set('trust proxy', 1)` is already set):
   - If `req.hostname === 'app.carinaai.uk'` (or generally: not one of the operator hostnames),
     delegate to a new hosted-session check instead of `req.session.webAuthed`.
   - Otherwise keep today's behaviour unchanged (`CARINA_WEB_PASSWORD` gate). This must not
     regress - re-run the existing smoke test (login with `CARINA_WEB_PASSWORD`, confirm `/`,
     `/api/chat` work, confirm logout works) before moving on.
   - Make the operator hostname list configurable via an env var, e.g.
     `CARINA_OPERATOR_HOSTS=core.carinaai.uk,localhost` (comma-separated, trimmed, lower-cased),
     so local dev (`localhost:3000`) still uses the simple password gate.

2. Add `hostedAccountId?: string` to the `SessionData` augmentation (alongside `webAuthed` - put
   it in `src/types/web-session.d.ts`). When a hosted user logs in, set
   `req.session.hostedAccountId = user.id`.

3. Build hosted login/register pages. Two options - pick the one that matches less new surface
   area:
   - **(Recommended) Reuse the existing static HTML + vanilla JS pattern** from
     `src/gateway/web/login.html` (just built for the operator gate) and the
     `console.labyrinthscout.com/public/account/*.html` pages (a near-identical multi-tenant
     account UI was just built there - same dark theme, same "register/login/dashboard" flow,
     same `escapeHtml`/`timeAgo` helpers). Copy that visual pattern, not the code (the data model
     is different - Carina users vs Scout subscribers).
   - Files to add: `src/gateway/web/hosted-login.html`, `src/gateway/web/hosted-register.html`.
     Forms POST to `/api/auth/login` and `/api/auth/register` (already implemented in
     `hosted.ts` - they return `{userId, apiKey, token}` JSON, not redirects, so the page's JS
     must capture the response, store nothing sensitive in localStorage, and instead call a new
     session-establishing endpoint - see step 4).

4. `hosted.ts`'s `/api/auth/login` and `/api/auth/register` return a JWT in the JSON body for API
   clients. For the *browser* flow we want a cookie-based session instead (consistent with the
   operator gate and with `console.labyrinthscout.com`'s account pages). Add two new routes
   (in a new file `src/api/hosted-web.ts`, mounted only when `req.hostname` matches the hosted
   domain, or simply always-mounted under `/app/auth/*` to avoid path collision with the existing
   Bearer-token API at `/api/auth/*`):
   - `POST /app/auth/register` - validates input, calls `registerUser`, then `loginUser`, then
     sets `req.session.hostedAccountId = userId` and responds `{ok: true}` (no token in the
     browser response body).
   - `POST /app/auth/login` - calls `loginUser`, sets `req.session.hostedAccountId`, responds
     `{ok: true}`.
   - `POST /app/auth/logout` - `req.session.destroy(...)`.
   - `GET /app/auth/me` - returns `{email, tier, apiKey}` for the logged-in hosted user (reuse
     `getUserProfile`), 401 if no session.

5. Update `requireWebAuth`'s hosted branch: valid if `req.session.hostedAccountId` is set AND
   `findAccountById`-equivalent (`getUserProfile(req.session.hostedAccountId)`) still resolves
   (handles deleted/banned accounts). Attach the resolved profile to
   `req.hostedUser = { id, email, tier }` (module-augment `Request` in
   `src/types/web-session.d.ts` or a new `src/types/hosted-request.d.ts`, mirroring the
   `scoutAuth` pattern in `console.labyrinthscout.com/src/middleware/auth.ts`).

### Acceptance criteria

- Hitting `https://app.carinaai.uk/` while logged out redirects to `/hosted-login` (or whatever
  path you choose - just be consistent) - never to the operator's `/login`.
- Hitting `https://core.carinaai.uk/` while logged out still redirects to the operator `/login`
  exactly as it does today (regression check).
- Registering a new hosted account, then refreshing the page, keeps you logged in (session
  cookie persists - test over real HTTPS, not plain HTTP, because `cookie.secure` is
  `NODE_ENV === 'production'`).
- Two different hosted accounts in two different browsers/incognito windows never see each
  other's `req.hostedUser`.

---

## Prompt 2 - Per-user conversation isolation (CRITICAL - do this before any real users sign up)

### The bug

`src/gateway/web.ts` keys every conversation off a client-supplied string:

```typescript
const externalId = String(req.body?.sessionId ?? 'anonymous');
const sessionId = await router.getSession('web', externalId);
```

`router.getSession(source, externalUserId)` (in `src/gateway/router.ts:43`) builds a Redis key
`carina:gateway:web:${externalUserId}` directly from that client-supplied value. On the hosted
domain this is a real vulnerability, not just a tidiness issue: User A can read or clear User B's
conversation history simply by sending the same `sessionId` string in the request body - no
auth bypass needed, because the *value itself* is the only key.

### The fix

In `setupChatRoutes` (or a hosted-specific variant of it - see "structuring the routes" below),
when the request is on the hosted domain, derive `externalId` from the **server-trusted**
identity, never from `req.body`:

```typescript
const externalId = req.hostedUser
  ? `hosted:${req.hostedUser.id}`
  : String(req.body?.sessionId ?? 'anonymous'); // operator/local dev path, unchanged
```

Apply this to all three handlers that call `router.getSession`/`router.clearSession`:
`POST /api/chat`, `POST /api/clear`, `GET /api/chat/stream`.

### Structuring the routes

You have two reasonable options - pick whichever keeps `setupChatRoutes` under ~20 lines per
function (per this repo's coding rules):

- (a) Add an `isHosted: boolean` parameter to `setupChatRoutes` and branch the `externalId`
  derivation inline (smallest diff), or
- (b) Extract a `resolveExternalId(req): string` helper used by all three handlers - cleaner if
  you anticipate more per-source logic later (you will, for quota - see Prompt 3).

Prefer (b). It also gives you one place to assert "hosted requests must have `req.hostedUser`"
(should be guaranteed by the gate from Prompt 1, but cheap to assert defensively at the call site
since a regression here is a privacy incident, not just a bug).

### Acceptance criteria

- Log in as hosted user A, send "remember the word banana", log out.
- Log in as hosted user B (different account), ask "what word did I ask you to remember" - must
  get no memory of "banana". Confirm via `redis-cli get carina:gateway:web:hosted:<A's-uuid>` and
  `...hosted:<B's-uuid>` that they are different keys with different session IDs.
- Confirm the **operator** path (`core.carinaai.uk`, `req.hostedUser` undefined) is completely
  unchanged - it must keep using `req.body.sessionId` exactly as before, since that's how the
  existing single-operator UI manages multiple browser tabs/devices.

---

## Prompt 3 - Wire up quota enforcement (the dead code that already exists)

### What exists

`src/api/hosted.ts` exports `checkHostedQuota(userId, tier): Promise<string | null>` - returns
an upgrade-prompt string if the free-tier daily cap (100 msgs/day, `config.hosted.freeDailyMessages`)
is hit, `null` if the user may proceed. It calls `incrementMessageCount` (in `hosted-auth.ts`,
already does the Postgres `UPDATE ... RETURNING tier, messages_today` dance with daily reset).
**It is never called anywhere.** This prompt just wires it in - no new backend logic needed.

### What to build

In the hosted branch of the `/api/chat` and `/api/chat/stream` handlers (after resolving
`req.hostedUser`, before calling `router.handle`):

```typescript
if (req.hostedUser) {
  const quotaMessage = await checkHostedQuota(req.hostedUser.id, req.hostedUser.tier);
  if (quotaMessage) {
    res.status(429).json({ error: quotaMessage, upgradeUrl: '/billing' });
    return;
  }
}
```

For the SSE stream handler, you can't `res.status(429).json(...)` after `res.flushHeaders()` -
emit it as an SSE error event instead: `res.write('data: ' + JSON.stringify({ error: quotaMessage }) + '\n\n'); res.write('data: [DONE]\n\n'); res.end();`

### Frontend

The hosted chat UI (you'll be adapting `src/gateway/web/index.html` or building a hosted variant
- see Prompt 1 step 3 framing) needs to handle a `429`/`{error, upgradeUrl}` response by showing
an "upgrade to Pro" banner instead of a generic error. Keep it to one unobtrusive banner - this
repo's style is plain, no modal-heavy UX.

### Acceptance criteria

- A fresh free-tier hosted account can send up to 100 messages in a UTC day; the 101st gets a
  clear "upgrade to Pro" message, not a raw 500 or a silent failure.
- A `pro`-tier account (set manually via `setUserTier(userId, 'pro')` for testing, or via Stripe
  in Prompt 4) never hits the cap - `checkHostedQuota` returns `null` immediately for `tier === 'pro'`.
- The daily counter resets at UTC midnight (this is already implemented in
  `incrementMessageCount` - just confirm it with a manual `UPDATE hosted_users SET messages_today = 100, last_message_date = CURRENT_DATE - INTERVAL '1 day'` and one more chat message).

---

## Prompt 4 - Stripe checkout (the webhook side already exists)

### What exists

`mountStripeWebhook` in `hosted.ts` already listens on `POST /webhooks/stripe`, verifies the
signature, and on `checkout.session.completed` calls `setUserTier(session.metadata.userId, 'pro')`.
**The only missing piece is the endpoint that creates the Checkout Session in the first place.**

### What to build

Add `POST /api/billing/checkout` (new route, mounted alongside `mountHostedRoutes`, protected by
the existing `authMiddleware` so `req.carinaUser` is populated):

```typescript
router.post('/checkout', authMiddleware, async (req, res) => {
  const user = (req as Request & { carinaUser: { id: string; email: string } }).carinaUser;
  const stripe = new Stripe(config.hosted.stripeSecretKey);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    line_items: [{ price: config.hosted.proPriceId, quantity: 1 }],
    success_url: 'https://app.carinaai.uk/billing?success=true',
    cancel_url: 'https://app.carinaai.uk/billing?canceled=true',
    metadata: { userId: user.id },
  });
  res.json({ url: session.url });
});
```

You'll need to:
- Add `proPriceId: process.env.STRIPE_PRO_PRICE_ID ?? ''` to `config.hosted` in
  `src/config/index.ts` (create the recurring Price in the Stripe dashboard first - "Carina Pro",
  monthly, get its `price_xxx` ID).
- Add an "Upgrade to Pro" button in the hosted UI that `POST`s to `/api/billing/checkout`,
  receives `{url}`, and does `window.location.href = url`.
- Add a `GET /billing` page (simple - shows current tier, an upgrade button if `free`, a "manage
  subscription" link to the Stripe customer portal if `pro`. The customer portal needs its own
  tiny endpoint, `POST /api/billing/portal`, using `stripe.billingPortal.sessions.create`).

### Acceptance criteria

- Use Stripe test mode + test card `4242 4242 4242 4242`. Complete checkout, confirm the webhook
  fires (check Stripe dashboard "Webhooks" event log, and confirm `hosted_users.tier` flips to
  `pro` in Postgres), confirm the quota cap disappears for that account without a server restart.
- Cancelling at the Stripe checkout page returns to `/billing?canceled=true` without changing
  the user's tier.

---

## Prompt 5 - Session memory leak fix (flagged in phase-5, still unfixed)

`prompts/phase-5-release.md` already documented this:

> `src/gateway/router.ts` keeps all `CarinaOrchestrator` instances in a `Map` forever. For the
> hosted product at `app.carinaai.uk` with real users this will leak memory.

This becomes load-bearing the moment `app.carinaai.uk` has more than a handful of concurrent
users - each `CarinaOrchestrator` holds LLM context, tool state, etc. Add the `lastSeen`
timestamp + periodic GC sweep exactly as phase-5 sketches it (see that file's "Session GC in
GatewayRouter" section for the starting code). This was written before hosted mode existed in
practice; it is now a prerequisite for launch, not a nice-to-have.

---

## Prompt 6 - Production rollout checklist

Once Prompts 1-5 are done and tested locally against a test Stripe account:

1. **Env vars** (add to `core.carinaai.uk/.env` on the VPS, alongside the
   `CARINA_WEB_PASSWORD`/`WEB_SESSION_SECRET` added for Track 1):
   ```
   HOSTED_MODE=true
   CARINA_OPERATOR_HOSTS=core.carinaai.uk
   JWT_SECRET=<openssl rand -hex 32>
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRO_PRICE_ID=price_...
   ```
   Switch Stripe from test mode to live mode keys only after a full test-mode run-through.

2. **Database**: `initHostedDb()` runs its own idempotent migration on first hosted request
   (see `hosted-migrations.ts`) - no manual schema work needed, but confirm the `hosted_users`
   table exists in `carina_central` after the first deploy (`\d hosted_users` in `psql`).

3. **DNS / nginx**: `app.carinaai.uk` is already in `docker/nginx/carina-prod.conf`'s
   `server_name` list and proxies to the same upstream as `core.carinaai.uk` - confirm the live
   nginx config on the VPS matches (it may have drifted; the Track-1 deploy only touched the app,
   not nginx). No new server block should be needed.

4. **Stripe webhook URL**: register `https://app.carinaai.uk/webhooks/stripe` in the Stripe
   dashboard (live mode) and copy the resulting signing secret into `STRIPE_WEBHOOK_SECRET`.

5. **Smoke test against production** (mirror the Track-1 smoke test pattern - curl through the
   real HTTPS path, not localhost, because of `cookie.secure`):
   - Register a real test account at `https://app.carinaai.uk/hosted-register`.
   - Send a chat message, confirm a reply.
   - Confirm `core.carinaai.uk` still requires `CARINA_WEB_PASSWORD` (regression check - this is
     the whole reason this document exists).
   - Run the Prompt-2 isolation test (two accounts, no cross-talk) one more time against prod
     Redis, not local.

6. **Restart**: `ssh malike@80.190.81.208 'sudo supervisorctl restart carina-core'` after the
   `.env` changes - supervisor does not pick up `.env` edits on its own.

---

## Order of operations

Do these in order - each one assumes the previous is done and tested:

1. Host-aware gate + hosted login/register (Prompt 1) - nothing else is safe to build on top of
   an auth layer that doesn't exist yet.
2. Per-user isolation (Prompt 2) - **do this before exposing registration to real users**. If
   you ship Prompt 1 without Prompt 2, you have a multi-tenant data leak, not a SaaS.
3. Quota enforcement (Prompt 3) - cheap, wires up code that already exists, stops free-tier
   abuse before you advertise the product.
4. Stripe checkout (Prompt 4) - only meaningful once quota (Prompt 3) gives free users a reason
   to upgrade.
5. Session GC (Prompt 5) - do this before any real marketing push; fine to ship a small private
   beta without it first if you're impatient, but do not skip it for a public launch.
6. Production rollout (Prompt 6) - the actual go-live.

---

## Carina Ops tenant isolation (Sprint 2)

Automated:

```bash
cd core.carinaai.uk && pnpm test src/api/__tests__/hosted-isolation.test.ts
```

Manual smoke: still recommended before release (two accounts, confirm no cross-org reads on billing, vault, and audit).
