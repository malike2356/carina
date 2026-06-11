---
sidebar_position: 6
---

# Credentials and API key pools

Carina can rotate across multiple API keys per provider and supports OAuth device login for integrations.

## Key pools

```bash
# .env
OPENAI_API_KEYS=sk-a,sk-b,sk-c
```

On rate limit or auth errors, Carina automatically tries the next key.

```bash
carina credentials status
carina credentials add openai sk-...
carina credentials rotate openai
```

## OAuth device flow

```bash
carina credentials oauth login github
carina credentials oauth list
```

Tokens are stored in `~/.carina/credentials.json` (mode `0600`).
