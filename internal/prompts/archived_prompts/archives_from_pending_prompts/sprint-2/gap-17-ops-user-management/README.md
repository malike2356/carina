# Gap 17 - Ops Panel User Management

**Gap:** 17
**Sprint:** 2
**Goal:** Replace single-password ops panel auth with a proper multi-user system.
  Each user has a name, email, and password. Admins can add, edit, and deactivate
  team members. Superadmin can generate a password-reset link without needing SMTP.

**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Risk:** Low. Additive. Existing ADMIN_PASSWORD env var remains as bootstrap fallback.

**Relation to SSO (gap-08):** This is the prerequisite. Gap-08 (SAML/OIDC/LDAP) plugs
into the user table added here. Do gap-17 first, gap-08 later.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Problem

The ops panel has a single shared password (`ADMIN_PASSWORD` in .env). There is no:
- Per-user identity (no name, no email)
- Multi-user access (no team members)
- Password reset (forgotten password = SSH to VPS to edit .env)
- Audit trail (no record of who did what)

---

## Design

### Database

New table `ops_users` in the `carina_central` database:

```sql
CREATE TABLE ops_users (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin','admin','viewer')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Roles:
- `superadmin`: can manage users, cannot be deleted
- `admin`: full ops access, cannot manage users
- `viewer`: read-only (reserved for future enforcement)

### Bootstrap

On first startup, if `ops_users` is empty, auto-create a superadmin from env vars:
- Email: `ADMIN_EMAIL` (default: `admin@carinaai.uk`)
- Password: `ADMIN_PASSWORD` (default: `changeme`, force-change on first login)
- Name: `ADMIN_NAME` (default: `Operator`)

After bootstrap the env-var password is ignored for authentication.

### Login flow

POST /login takes `email` + `password`. Session stores `userId` and `role`.
`requireAdmin` middleware checks `req.session.userId` exists and user is active.

### Password reset (no SMTP needed)

Superadmin goes to Users list, clicks "Reset password" on any user.
Server generates a single-use token (valid 24 h), stores it in `reset_token`.
Shows a reset link in the UI. Superadmin copies and sends to the user however they like.
User opens the link, sets a new password, token is cleared.

Public reset URL: `/reset-password/:token`
This route is outside the `requireAdmin` wall (like `/login`).

---

## Prompt inventory

```
gap-17-ops-user-management/
├── README.md              (this file)
└── 01-build.md            Full implementation spec (schema + routes + views + bootstrap)
```

**Status:** 01-build.md - COMPLETED 2026-06-21
