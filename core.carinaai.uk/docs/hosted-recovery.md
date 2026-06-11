# Hosted auth recovery

Use this guide when you are locked out of the hosted login at your Carina instance and need to regain access without touching the database by hand.

## Bootstrap account (env-driven)

Set two env vars before starting Carina:

```
HOSTED_BOOTSTRAP_EMAIL=admin@example.com
HOSTED_BOOTSTRAP_PASSWORD=a-strong-password-here
```

On the next startup Carina will:

1. Run hosted migrations automatically if the `hosted_users` table is missing.
2. Create the bootstrap account if it does not exist yet.
3. Log `[hosted-bootstrap] bootstrap account created: admin@example.com` (never the password).
4. If the account already exists, log `[hosted-bootstrap] bootstrap account exists: admin@example.com` and leave the password unchanged.

You can then sign in at `/hosted-login` with those credentials using the normal login form.

## Applying bootstrap without a restart

If you cannot restart the server, use the CLI:

```bash
# Reads HOSTED_BOOTSTRAP_EMAIL and HOSTED_BOOTSTRAP_PASSWORD from the current env.
carina hosted bootstrap
```

This runs migrations and creates the account exactly as startup would.

## Forcing a password reset

If the bootstrap account exists but you have forgotten its password, use the `--reset` flag. This is the only path that overwrites an existing password without a confirmation step - it is deliberate and explicit:

```bash
HOSTED_BOOTSTRAP_EMAIL=admin@example.com \
HOSTED_BOOTSTRAP_PASSWORD=new-password-here \
carina hosted bootstrap --reset
```

The flag is also accepted in `.env` when you restart the server, but the reset only fires if `--reset` is passed on the CLI or if the account does not exist yet. Startup never force-resets automatically.

## Direct account recovery (no env vars)

If you prefer to set an arbitrary email and password directly:

```bash
carina hosted reset-password admin@example.com new-password-here
```

This creates the account if it does not exist or replaces the password if it does. It does not require the bootstrap env vars.

## Rotating or clearing the bootstrap account

Once you have a permanent account (registered through the normal UI or `reset-password`):

1. Remove `HOSTED_BOOTSTRAP_EMAIL` and `HOSTED_BOOTSTRAP_PASSWORD` from your `.env` / Docker env.
2. Restart the server. With the vars absent, the bootstrap path is completely skipped.

The bootstrap account itself is a normal `hosted_users` row. You can delete it via the admin panel or with:

```bash
psql $DATABASE_URL -c "DELETE FROM hosted_users WHERE email = 'admin@example.com';"
```

## Security notes

- Plaintext passwords are never logged, stored, or returned from any endpoint.
- The bootstrap vars only create/update an account; they do not grant any special runtime privileges.
- Set `HOSTED_BOOTSTRAP_PASSWORD` to a strong value (16+ random characters). Rotate it after recovery.
- Do not commit `.env` files containing real passwords.
