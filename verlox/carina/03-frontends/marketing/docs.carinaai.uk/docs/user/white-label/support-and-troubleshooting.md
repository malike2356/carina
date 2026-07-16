---
sidebar_position: 8
title: Support and troubleshooting
description: FAQ and fixes for branded Carina Cloud and self-hosted white-label deployments.
---

# Support and troubleshooting (white-label)

## Brand does not update on login page

**Symptom:** Still shows `Carina Cloud` after saving brand settings.

**Causes:** Browser cache, wrong host (platform URL instead of custom domain), or non-owner saving brand.

**Fix:**

1. Confirm you are workspace owner.
2. Hard refresh or use incognito on the same host clients will use.
3. Check `GET /api/brand` on that host.
4. For custom domains, complete DNS verification first.

---

## Custom domain verification fails

**Symptom:** TXT record published but verification errors.

**Causes:** Wrong record name (`_carina-verify` subdomain), propagation delay, or proxy/CDN stripping TXT.

**Fix:**

1. Use the exact token from the workspace domains UI.
2. Wait up to 24 hours for DNS propagation.
3. Query with `dig TXT _carina-verify.yourdomain.com`.
4. Disable orange-cloud/proxy on the TXT record if using Cloudflare.

---

## Client sees wrong packs

**Symptom:** Vertical bundle missing or competitor packs visible.

**Causes:** Pack not enabled, partner catalog scope, or marketplace disabled on self-hosted.

**Fix:**

1. Open **Skill packs** and install the bundle again.
2. Partner operators: check `pack_catalog` on partner account.
3. Self-hosted: set `ACTIVE_SKILL_PACKS` or use `carina packs enable`.

---

## Emails still from Carina address

**Symptom:** Invites sent from platform sender.

**Causes:** `senderEmail` not set, domain not verified for email, or hosted defaults still active.

**Fix:**

1. Set `senderName` and `senderEmail` in brand settings.
2. Configure Resend/domain authentication per your operator runbook.
3. Resend test invite after canonical domain is active.

---

## Billing shows Carina plan names

**Symptom:** Client sees generic plan labels.

**Fix:** Set `productName` in brand settings. Reload **Billing** page.

---

## Docker stack isolation

**Symptom:** Ops panel shows another customer's containers.

**Causes:** Missing ops scope env on shared host.

**Fix:**

```bash
export CARINA_WHITE_LABEL_STACK=client-stack-name
# or
export OPS_DOCKER_PROJECTS=client-stack-name
```

Deploy with `./scripts/deploy-white-label-stack.sh up -d`. Smoke test:

```bash
./scripts/smoke-docker-scope.sh
```

Full white-label release verification (branding, tenant fixtures, copy guard, app + ops tests):

```bash
./scripts/verify-white-label.sh
```

Per-package shortcuts:

```bash
cd backends/servers/core.carinaai.uk && pnpm test:white-label
cd frontends/client-apps/app.carinaai.uk && pnpm test:white-label
cd backends/admin/ops.carinaai.uk && pnpm test:white-label
```

---

## Marketplace disabled on self-hosted

**Symptom:** No vertical bundle cards in Skill packs.

**Expected:** Self-hosted single-tenant installs may hide marketplace UI. Enable packs via CLI or `ACTIVE_SKILL_PACKS`.

---

## Who to contact

| Issue type | Contact |
| --- | --- |
| Your product SLA | Your support email (set in brand) |
| Hosted platform outage | Your operator escalation to VERLOX |
| Kernel bug | [GitHub issues](https://github.com/malike2356/carina-mutant/issues) for open-source path |
| Scout product | Labyrinth Scout support per your Scout contract |

## Related

- [Troubleshooting (general)](/docs/user/troubleshooting)
- [Custom domains](/docs/user/white-label/custom-domains)
- [Customer handoff](/docs/user/white-label/customer-handoff)
