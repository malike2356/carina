# SOP 026: Enterprise SSO Testing and Troubleshooting
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** app.carinaai.uk SSO module
**Last reviewed:** 2026-06-26

**Prerequisites:** `023-enterprise-sso-overview.md`, `024-enterprise-sso-oidc-setup.md` or `025-enterprise-sso-saml-setup.md`

---

# SSO testing, policy, and troubleshooting

---

## 1. Pre-go-live test plan

Run in order after provider creation:

| # | Test | Pass criteria |
|---|------|---------------|
| 1 | Discovery | `POST /api/auth/sso/resolve` with `user@company.com` returns `ssoAvailable: true` |
| 2 | Public domain blocked | `user@gmail.com` returns `ssoAvailable: false` |
| 3 | OIDC/SAML round trip | Incognito login → IdP → lands in app with session |
| 4 | JIT member | New IdP user appears in workspace members with default role |
| 5 | Return visit | Same user logs in again without duplicate account |
| 6 | Domain mismatch | IdP user with wrong email domain gets `sso_domain` error |
| 7 | Owner password fallback | With **Require SSO** on, owner can still use password via fallback link |

### curl: discovery smoke test

```bash
curl -sS -X POST https://app.carinaai.uk/api/auth/sso/resolve \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@company.com"}'
```

Expected when provider exists and is enabled:

```json
{"ssoAvailable":true,"providerId":"...","providerType":"oidc","domain":"company.com","ssoRequired":false}
```

---

## 2. Mandatory SSO policy

After basic login works, workspace owners may enable **Require SSO for this domain**.

### Behavior

| User | Password login | SSO |
|------|----------------|-----|
| Member `@company.com` | Hidden by default | Required |
| Workspace owner | Available via **Workspace owner? Sign in with password** | Available |

This prevents a bad IdP config from permanently locking out the owner.

### Enable steps

1. **Settings → Security → Single sign-on** → **Edit** provider.
2. Turn on **Require SSO for this domain**.
3. Save.
4. Test member flow (password hidden) and owner fallback.

Audit event: `sso.policy.updated`.

---

## 3. Login URL error codes

| Query param | Meaning | Fix |
|-------------|---------|-----|
| `sso_expired` | State cookie missing or older than 10 min | Restart from `/login` |
| `sso_state` | CSRF state mismatch | Retry; check clock skew |
| `sso_domain` | IdP email domain ≠ configured domain | Fix IdP attribute mapping or Carina domain |
| `sso_config` | Missing client secret, issuer, SSO URL, or cert | Edit provider in settings |
| `sso_provider` | Provider disabled or deleted | Re-enable or recreate |
| `sso_failed` | Token exchange or SAML validation failed | Check IdP logs and Carina audit |

---

## 4. Common problems

| What you see | Likely cause |
|--------------|--------------|
| No SSO button on login | Domain typo, provider disabled, or public mailbox domain |
| Discovery returns false | No enabled provider for that exact domain |
| User not in workspace | Provider created on a different workspace |
| Duplicate users | Same person used email/password before SSO; accounts link on email match |
| SSO works on app but not Aiva host | Same callbacks; user must use company email on `admin.hireaiva.co.uk/login` too |

---

## 5. Audit events (operator)

Inspect workspace audit log for:

| Event | When |
|-------|------|
| `sso.provider.created` | New provider saved |
| `sso.provider.updated` | Metadata changed |
| `sso.provider.disabled` | Provider turned off |
| `sso.provider.deleted` | Provider removed |
| `sso.policy.updated` | `ssoRequired` or policy fields changed |
| `sso.discovery.matched` | Login page resolved a domain |
| `sso.login.succeeded` | Callback completed |
| `sso.login.failed` | Callback or token exchange failed |
| `sso.login.blocked_by_policy` | Email domain mismatch |
| `sso.user.provisioned` | New user created via SSO |
| `sso.workspace_member.created` | User added to workspace |

Do not log raw SAML assertions, tokens, or client secrets.

---

## 6. Secret and certificate rotation

### OIDC client secret

1. Rotate secret in IdP.
2. Carina → Edit provider → paste new **Client secret** → Save.
3. Test login before revoking old secret in IdP.

### SAML certificate

See `025-enterprise-sso-saml-setup.md` Step 4.

---

## 7. Operator / deploy notes

### Database

Table: `workspace_sso_providers`  
Migration: `03-frontends/client-apps/app.carinaai.uk/src/db/migrations/0015_workspace_sso.sql`

Verify on VPS:

```bash
ssh malike@80.190.81.208 \
  "docker exec corecarinaaiuk-postgres-1 psql -U carina -d carina_cloud -c \"SELECT to_regclass('workspace_sso_providers');\""
```

### Environment (production)

| Variable | Purpose |
|----------|---------|
| `VAULT_SECRET` or `BETTER_AUTH_SECRET` | Encrypts OIDC secrets and SAML certs at rest |
| `NEXT_PUBLIC_APP_URL` | Must be `https://app.carinaai.uk` for correct callback URLs |
| `BETTER_AUTH_URL` | Better Auth base URL |

### Disable a broken provider safely

1. **Settings → Edit provider → disable Enable provider** (fastest).
2. Or delete provider after confirming members have another sign-in path.
3. Owners can always use password fallback if **Require SSO** was enabled.

### Deploy

Migration `0015` is listed in `app.carinaai.uk/deploy.sh`. After deploy, confirm migration applied:

```bash
ssh malike@80.190.81.208 \
  "docker exec corecarinaaiuk-postgres-1 psql -U carina -d carina_cloud -c \"SELECT filename FROM __deploy_migrations WHERE filename LIKE '%sso%';\""
```

---

## 8. Disable SSO for a customer (offboarding)

1. Disable or delete provider in Carina settings.
2. Remove Carina app from customer IdP.
3. Confirm affected users can still sign in via email/password if they had credentials before SSO.
4. Review workspace members and remove access as needed.

---

## Related

- Overview: `023-enterprise-sso-overview.md`
- OIDC: `024-enterprise-sso-oidc-setup.md`
- SAML: `025-enterprise-sso-saml-setup.md`
- User/auth map: `004-user-management-and-access.md`
- Deploy: `002-deployment-guide.md`
