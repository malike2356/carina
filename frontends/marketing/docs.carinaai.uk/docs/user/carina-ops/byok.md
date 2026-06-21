# BYOK: connect provider keys

Carina Ops **Vault** stores your team provider keys encrypted at rest. Carina uses these keys for workbench runs and org-scoped inference; keys are never returned in API responses or audit details.

## Supported providers (v1)

Minimum supported set:

- **OpenAI** (`openai`)
- **Anthropic** (`anthropic`)
- **DeepSeek** (`deepseek`)

You may add other providers if your key format is accepted by the vault form. Use the provider slug that matches your routing config.

## Add a key

1. Open `/ops/vault`.
2. Choose provider, paste API key, optional base URL or model override.
3. Save. The UI shows provider name and status only; not the secret.

## Security notes

- Keys are encrypted with `TENANT_KEY_ENCRYPTION_KEY` on the server.
- Audit events log provider name and action; never raw key material.
- Do not paste production keys into chat or workbench titles.

## Rotation

To rotate a key:

1. Add the new key for the same provider (overwrite), or
2. Remove the old entry and add a fresh one.

There is no in-place reveal of stored keys. Deletion is immediate for new workbench runs.

## Plan limits

| Plan | Max BYOK providers |
|---|---|
| Starter | 3 |
| Team | 10 |

See [Plans](./plans.md) for full limits.

## Cost control

BYOK is the safest margin path for heavier teams because the customer pays the model bill directly. Use BYOK when:

- usage is unpredictable
- the team wants explicit provider accounts
- premium model access would otherwise erode plan margin
- the org wants to separate platform spend from inference spend

If the customer does not want BYOK, keep the plan capped and enforce weighted credits.
