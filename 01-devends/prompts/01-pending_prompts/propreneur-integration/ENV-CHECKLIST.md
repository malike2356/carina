# Environment and E2E Checklist

Run after deploying prompts 01-11. Edit env on local machine only; deploy via `./scripts/deploy-to-production.sh` (Propreneur) and `bash deploy.sh` (Carina).

---

## Path A: Carina Standalone -> Propreneur Carina chat

1. In **app.carinaai.uk** (Aiva worker detail), bind Propreneur: workspace slug + Remote API key from Propreneur Settings > Carina Remote.
2. In Carina chat, ask: "Use Propreneur to summarise properties with compliance issues."
3. Expected: `propreneur-carina-chat` tool calls `POST https://{slug}.propreneur.uk/api/remote/carina/chat`.
4. In Propreneur: new `CarinaConversation` type `remote`, session key prefix `carina_standalone_`.

**UI location:** `app.carinaai.uk` worker page uses `PropreneurBindingPanel` (Prompt 10 done in cloud app).

---

## Path B: Hub inbound to Propreneur Carina

```bash
SECRET="your_CARINA_HUB_WEBHOOK_SECRET"
BODY='{"message":"What properties do I have?","external_id":"hub_user_test","session_id":"hub_test_001","callback_url":"https://core.carinaai.uk/api/inbound/propreneur-reply"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://propreneur.uk/api/remote/inbound/carina-hub \
  -H "Content-Type: application/json" \
  -H "X-Carina-Hub-Signature: $SIG" \
  -d "$BODY"
```

Pre-conditions:
- Channel mapping: `carina_hub` + `external_id` -> workspace user (`/settings/carina-remote`)
- Active API key assigned for `carina_hub` channel

---

## Path C: Propreneur skills include Hub packs

```bash
php artisan carina:compile-skills
php artisan carina:compile-skills --skip-hub   # local SKILL.md only
```

Or from Propreneur settings: Carina Remote > Skills Hub > **Sync Hub Skills**.

---

## Path D: Proactive push to Hub (Prompt 11)

```bash
php artisan carina:test-hub-push test_session "hello from Propreneur"
```

Requires `CARINA_HUB_REPLY_URL` and `CARINA_HUB_WEBHOOK_SECRET` on Propreneur.

---

## Environment variables

### Propreneur (`.env`)

```
CARINA_HUB_WEBHOOK_SECRET=          # openssl rand -hex 32
CARINA_HUB_REPLY_URL=https://core.carinaai.uk/api/inbound/propreneur-reply
SKILLS_HUB_URL=https://hub.carinaai.uk
SKILLS_HUB_PUBLISH_KEY=
CARINA_HUB_PACKS=propreneur-workspace,legal-uk,sales-crm,finance
```

### Carina core (`.env`)

```
CARINA_HUB_WEBHOOK_SECRET=          # SAME as Propreneur
PROPREENEUR_TENANT_BASE_DOMAIN=propreneur.uk
PROPREENEUR_BRIDGE_ENABLED=true
```

---

## Smoke tests (production)

```bash
curl -sk -o /dev/null -w "%{http_code}" https://propreneur.uk/platform/login

curl -sk https://hub.carinaai.uk/api/packs | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['packs']), 'packs')"

curl -sk -X POST https://propreneur.uk/api/remote/inbound/carina-hub \
  -H "Content-Type: application/json" -d '{}'

curl -sk -X POST https://core.carinaai.uk/api/inbound/propreneur-reply \
  -H "Content-Type: application/json" -d '{}'
```

Expect 401/503 on the last two (not 404).

---

## Already built (no separate work)

| Item | Status |
|------|--------|
| `/api/remote/carina/chat` | Production-ready |
| Aiva bridge read/write tools | Working |
| Carina Remote settings + API keys | `/settings/carina-remote` |
| Hub packs API | `hub.carinaai.uk/api/packs` |
| Propreneur bind UI | `app.carinaai.uk` `PropreneurBindingPanel` |
| Aiva bridge auth same as Remote API | Prompt 08 skipped |
