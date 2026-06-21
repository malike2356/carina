# Prompt 05: Scout Public REST API


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

External tools (SIEMs, ticketing systems, custom dashboards) need to integrate with Scout.
A public REST API with API key authentication enables these integrations. The API exposes
events, scores, reports, and alert management.

## What to Build

### 1. API key management

Create `console.labyrinthscout.com/src/api/keys.ts`:
```typescript
export async function generateApiKey(tenantId: string, name: string): Promise<string> {
  const key = `sk-scout-${randomHex(40)}`;
  const hash = sha256(key);
  await db.query(
    'INSERT INTO api_keys (tenant_id, name, key_hash, created_at) VALUES ($1, $2, $3, NOW())',
    [tenantId, name, hash]
  );
  return key; // returned once, then only the hash is stored
}

export async function validateApiKey(key: string): Promise<string | null> {
  const hash = sha256(key);
  const result = await db.query(
    'SELECT tenant_id FROM api_keys WHERE key_hash = $1 AND revoked = false',
    [hash]
  );
  return result.rows[0]?.tenant_id ?? null;
}
```

### 2. API key auth middleware

```typescript
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer sk-scout-')) {
    res.status(401).json({ error: 'API key required (Bearer sk-scout-...)' });
    return;
  }
  const tenantId = await validateApiKey(header.slice(7));
  if (!tenantId) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }
  req.tenantId = tenantId;
  next();
}
```

### 3. Public API routes

```
GET    /v1/events                    - list events (paginated)
GET    /v1/events/:id               - get single event
PATCH  /v1/events/:id/resolve       - mark event as resolved
GET    /v1/score                     - current score
GET    /v1/score/history            - score history
GET    /v1/assets                   - list registered assets
POST   /v1/assets                   - register an asset
DELETE /v1/assets/:id              - remove an asset
GET    /v1/reports                  - list reports
POST   /v1/reports                  - generate report (async)
GET    /v1/webhooks                 - list webhook configs
POST   /v1/webhooks                 - register webhook
DELETE /v1/webhooks/:id            - remove webhook
```

Rate limit: 100 requests per minute per API key.

### 4. Webhook delivery

When a Scout event fires, deliver it to all registered webhooks for the tenant:
```typescript
export async function deliverWebhooks(tenantId: string, event: ScoutEvent): Promise<void> {
  const webhooks = await db.query(
    'SELECT url, secret FROM webhooks WHERE tenant_id = $1 AND enabled = true',
    [tenantId]
  );

  for (const webhook of webhooks.rows) {
    const payload = JSON.stringify(event);
    const signature = hmacSha256(webhook.secret, payload);

    await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Signature': `sha256=${signature}`,
      },
      body: payload,
    }).catch(err => console.error(`Webhook delivery failed: ${err.message}`));
  }
}
```

### 5. API documentation page

Create `console.labyrinthscout.com/public/api-docs.html` - a simple HTML page documenting
all endpoints with curl examples. No external dependencies (plain HTML/CSS matching the
labyrinthscout.com dark theme).

Link from the dashboard footer: "API Documentation".

## Verification Checklist

- [ ] API score endpoint returns JSON when called with a valid Scout API token
- [ ] Invalid API key returns 401
- [ ] 101st request in a minute returns 429 rate limit error
- [ ] Register a webhook, trigger an event - webhook receives POST with event JSON
- [ ] Webhook signature can be verified with HMAC-SHA256 of the secret

## Files to Create or Modify

- CREATE `console.labyrinthscout.com/src/api/keys.ts`
- CREATE `console.labyrinthscout.com/src/api/v1/events.ts`
- CREATE `console.labyrinthscout.com/src/api/v1/score.ts`
- CREATE `console.labyrinthscout.com/src/api/v1/assets.ts`
- CREATE `console.labyrinthscout.com/src/api/v1/webhooks.ts`
- MODIFY `console.labyrinthscout.com/src/server.ts` - mount v1 routes with rate limiting
- CREATE `console.labyrinthscout.com/public/api-docs.html`
