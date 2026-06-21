# Prompt 04: Environment Variable Editor


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Operators configure Carina via `.env` files. Editing `.env` requires SSH access to the
server, which is friction for non-technical operators. An env var editor in the ops admin
panel (behind the same admin password auth) lets operators manage runtime config without
SSH.

Critical: this editor must NEVER expose the current values of secrets (API keys, tokens,
passwords) in the UI. It shows which keys are set (green dot) and allows setting new values,
but never returns the existing value of a secret.

## What to Build

### 1. Env API in Carina core

In `src/api/env.ts`, add ops-gated routes:
```
GET  /api/ops/env         - list all known env vars (key + isSet, never value)
POST /api/ops/env         - set one or more env vars (writes to .env file + reloads)
DELETE /api/ops/env/:key  - unset an env var (removes from .env file)
```

Env var schema (defined in `src/config/env-schema.ts`):
```typescript
type EnvVarDef = {
  key: string;
  description: string;
  required: boolean;
  category: 'llm' | 'database' | 'email' | 'auth' | 'integrations' | 'scout' | 'other';
  isSecret: boolean; // if true, value is never returned to client
};
```

Define all known env vars from `.env.production.example` in the schema. When `GET /api/ops/env`
is called, return `{ key, description, required, category, isSecret, isSet: boolean }`.
Never return the actual value.

### 2. .env file writer

When `POST /api/ops/env` is called with `{ KEY: "value" }`:
1. Read current `.env` file
2. Update or append the key=value line
3. Write the updated content back atomically (write to `.env.tmp` then rename)
4. Call `dotenv.config({ override: true })` to reload the process env in-place
5. Log the change to Scout: `{ action: 'env-set', key: 'OPENAI_API_KEY', timestamp }`

NOTE: Never log the value, only the key name.

### 3. Ops admin env tab

In `ops.carinaai.uk/views/env.ejs`, create an env editor page:
- Category sections (LLM, Database, Email, Auth, Integrations, Scout, Other)
- Each var shows: key name, description, required badge, set/not-set status indicator
- Click any row to open an edit modal with a password-type input (value not shown)
- "Save" button writes new value via POST to core API
- "Unset" button removes the var
- Green dot = set, amber dot = required but not set (warning), gray dot = optional and not set

### 4. Required-vars validation

When the ops panel loads the env tab, warn if any required vars are not set:
```
WARNING: 2 required environment variables are not set:
  - GEMINI_API_KEY (LLM) - needed for embeddings
  - RESEND_API_KEY (Email) - needed for incident blog newsletter
```

## Verification Checklist

- [ ] Env tab loads and shows categories with set/not-set indicators
- [ ] API never returns actual secret values (inspect network tab)
- [ ] Set a new OPENAI_API_KEY value - next chat session uses updated key
- [ ] Required-but-unset vars show amber warning with description
- [ ] Scout log shows `env-set` event with key name (no value) after save

## Files to Create or Modify

- CREATE `src/api/env.ts`
- CREATE `src/config/env-schema.ts`
- MODIFY `src/server.ts` - mount env API routes
- CREATE `ops.carinaai.uk/routes/env.ts`
- CREATE `ops.carinaai.uk/views/env.ejs`
- MODIFY `ops.carinaai.uk/views/layout.ejs` - add nav link
- MODIFY `ops.carinaai.uk/server.ts` - register env routes
