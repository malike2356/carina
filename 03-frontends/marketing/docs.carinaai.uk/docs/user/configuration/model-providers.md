# Model providers

Configure LLM providers, failover, and custom OpenAI-compatible endpoints.

:::tip
Basic env vars also appear in [Configuration](/docs/user/configuration). This page is the deep dive.
:::

## Built-in providers

Carina ships adapters for common providers (availability depends on your install version):

| Provider | Typical env vars |
|---|---|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Groq | `GROQ_API_KEY` |

Set default:

```
DEFAULT_PROVIDER=anthropic
DEFAULT_MODEL=claude-sonnet-4-20250514
```

CLI: `carina model list`, `carina model set anthropic`.

## Carina Cloud BYOK

In app.carinaai.uk, add keys under **Settings > API keys**. Keys are encrypted per workspace. The cloud app routes chat to your chosen provider without storing plaintext in the browser.

## Custom OpenAI-compatible endpoint

```
CUSTOM_OPENAI_BASE_URL=https://llm.example.com/v1
CUSTOM_OPENAI_API_KEY=...
CUSTOM_OPENAI_MODEL=my-model
```

Or register a [provider plugin](/docs/developer/plugins/building-plugins).

## Failover and pools

Credential pools rotate keys on rate limit (`brain/credential-pools.ts`). Configure multiple keys for the same provider in advanced setups.

## Model selection per session

Users can switch with `/provider` in CLI or web chat. Profiles can pin defaults per workspace.

## Verification

```bash
carina model status
carina doctor
```

## Related

- [Configuration](/docs/user/configuration)
- [Carina Ops BYOK](/docs/user/carina-ops/byok)
