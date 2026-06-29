# Prompt 12: End-to-End Test and Environment Checklist

**Both codebases**
**No new code** - this is a verification and wiring-up prompt

## Purpose

After Prompts 01-11 are done, run through this checklist to confirm the full integration
works end-to-end. Each section maps to one integration path.

---

## Path A: Carina Standalone -> Propreneur Carina chat

**Test: user types a complex property question in Carina Standalone**

1. Ensure a Propreneur workspace is connected to the Carina worker:
   - In Carina settings UI (Prompt 10): enter workspace slug + Remote API key
   - Click Connect, confirm "X properties found"

2. In Carina Standalone chat, type:
   "Use Propreneur to give me a summary of all properties with compliance issues"

3. Expected:
   - Carina selects skill `property-ai-task` from `propreneur-workspace` pack (Prompt 05)
   - Calls `propreneur-carina-chat` tool (Prompt 04)
   - Tool calls `chatWithCarina()` bridge function (Prompt 03)
   - `POST https://{slug}.propreneur.uk/api/remote/carina/chat` with Bearer token
   - Propreneur's CarinaAgentService runs with full tenant context
   - Reply returns to Carina Standalone and is shown to user

4. Verify in Propreneur: a new `CarinaConversation` of type `remote` was created with
   `metadata.channel = 'http'` and the session key starts with `carina_standalone_`

---

## Path B: Hub sends a message to Propreneur Carina inbound

**Test: Hub POSTs to Propreneur's CarinaHub adapter**

Run this curl on the VPS or locally (replace values):

```bash
SECRET="your_CARINA_HUB_WEBHOOK_SECRET"
BODY='{"message":"What properties do I have?","external_id":"hub_user_test","session_id":"hub_test_001","callback_url":"https://core.carinaai.uk/api/inbound/propreneur-reply"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://propreneur.uk/api/remote/inbound/carina-hub \
  -H "Content-Type: application/json" \
  -H "X-Carina-Hub-Signature: $SIG" \
  -d "$BODY"
```

Expected: 200 JSON with `{ ok: true }` or similar.
Check Propreneur logs for `carina_remote_dispatch` audit event with `remote_channel = carina_hub`.
Check Hub logs (or use a test callback URL like httpbin.org) to confirm the reply POST arrived.

**Pre-condition:** The `external_id` `hub_user_test` must be mapped to a Propreneur user
via `carina_remote_channel_mappings` with `channel = carina_hub`. Insert a test row:
```sql
INSERT INTO carina_remote_channel_mappings (channel, external_id, user_id, is_active)
VALUES ('carina_hub', 'hub_user_test', {your_user_id}, true);
```

Also: an active API key must exist in `carina_remote_api_keys` with `channel = carina_hub`
(or any key with `abilities = ["carina:chat"]`). The CarinaHubChannelAdapter uses HMAC not
Bearer, so the Gateway resolves the API key differently - check how the inbound controller
picks the API key for non-Bearer channels. It may use `CarinaRemoteChannelKeyResolver`.
Set the channel key mapping at `/settings/carina-remote` in the tenant workspace.

---

## Path C: Propreneur skills include Hub packs

**Test: artisan compile-skills fetches from Hub**

```bash
# On VPS, inside Docker:
docker exec propreneur-fpm php artisan carina:compile-skills

# Check output: should say something like "47 skills compiled. 0 failed."
# (was 3 before the Hub packs were added)

# Confirm Hub skills in manifest:
docker exec propreneur-fpm php -r "
  \$m = json_decode(file_get_contents('/var/www/html/storage/app/carina/compiled-skills.json'), true);
  \$hub = array_filter(\$m['skills'], fn(\$s) => (\$s['source'] ?? '') === 'hub');
  echo count(\$hub) . ' hub skills loaded\n';
"
```

---

## Environment variables checklist

### Propreneur VPS (.env at /www/wwwroot/propreneur-v2/.env)

Add these if not present. Edit on local machine and deploy via `./scripts/deploy-to-production.sh`.
NEVER edit directly on the VPS.

```
CARINA_HUB_WEBHOOK_SECRET=          # generate: openssl rand -hex 32
CARINA_HUB_REPLY_URL=https://core.carinaai.uk/api/inbound/propreneur-reply
SKILLS_HUB_URL=https://hub.carinaai.uk
SKILLS_HUB_PUBLISH_KEY=             # leave empty for free packs
CARINA_HUB_PACKS=propreneur-workspace,legal-uk,sales-crm,finance
```

### Carina VPS (/home/malike/apps/core.carinaai.uk/.env or docker-compose env)

Add these via the Carina deploy config:

```
CARINA_HUB_WEBHOOK_SECRET=          # SAME value as Propreneur's CARINA_HUB_WEBHOOK_SECRET
PROPREENEUR_TENANT_BASE_DOMAIN=propreneur.uk   # already set
PROPREENEUR_BRIDGE_BASE_URL=        # leave empty (uses tenant slug + base domain)
```

To update on Carina VPS: edit locally in `core.carinaai.uk/.env` (or the docker-compose
env file) and run `bash deploy.sh`.

---

## Smoke tests (run after deploy)

```bash
# 1. Propreneur login still works (regression)
curl -sk -o /dev/null -w "%{http_code}" https://propreneur.uk/platform/login
# expect: 200

# 2. Hub packs API still works
curl -sk https://hub.carinaai.uk/api/packs | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['packs']), 'packs')"
# expect: 23 packs (was 22, now includes propreneur-workspace)

# 3. Propreneur inbound route exists
curl -sk -X POST https://propreneur.uk/api/remote/inbound/carina-hub \
  -H "Content-Type: application/json" -d '{}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))"
# expect: "Invalid signature" or "Unauthorized" (401), NOT 404

# 4. Hub reply webhook exists
curl -sk -X POST https://core.carinaai.uk/api/inbound/propreneur-reply \
  -H "Content-Type: application/json" -d '{}' | python3 -c "import sys,json; print(json.load(sys.stdin))"
# expect: 401 or 503 (not 404)
```

---

## What does NOT need to be built separately

- Propreneur's existing Remote API (`/api/remote/carina/chat`) - already production-ready
- Carina's existing Propreneur bridge (portfolio, compliance, deals reads) - already working
- Auth/API key generation UI in Propreneur - already at `/settings/carina-remote`
- Hub skills API (`/api/packs`) - already live at `hub.carinaai.uk/api/packs`
