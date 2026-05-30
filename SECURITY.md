# Security: Never Commit Credentials

**No API keys, passwords, tokens, or .env files belong in this repository.**

## Local development credentials

All credentials for local development live in one place only:

```
/opt/lampp/htdocs/_local/secrets/api-keys.env
```

To generate a project .env from that master file:

```bash
/opt/lampp/htdocs/_local/scripts/make-env.sh <path-to-project> [subdir]
```

## Files that must never be committed

- `.env` and any variant (`.env.local`, `.env.prod`, `.env.staging`, etc.)
- Bare `env` files
- `*.buk`, `*.backup` files that contain real values
- Any file containing a real password, token, or private key

## If you are setting up this project on a new machine

1. Copy `.env.example` to `.env`
2. Run make-env.sh (it fills in API keys from the master file automatically)
3. Fill in any project-specific values (DB credentials, APP_URL, etc.)

## Deployed (server) environments

Credentials on the server are managed outside git entirely. See the server
runbook at `/opt/lampp/htdocs/_local/documentations/INFRASTRUCTURE_AND_HOSTING.md`
for the server-side secrets approach.
