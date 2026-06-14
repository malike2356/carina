# Getting started with Carina Ops

This guide matches the onboarding wizard in the Carina Ops UI. Target: first workbench prompt in under 10 minutes.

## 1. Register

Create an account at [app.carinaai.uk/hosted-register](https://app.carinaai.uk/hosted-register). You get a personal org automatically.

## 2. Open Carina Ops

After sign-in, go to [app.carinaai.uk/ops/](https://app.carinaai.uk/ops/). New orgs see the onboarding wizard until setup is complete or dismissed.

## 3. Start trial or subscribe

Open **Billing** (`/ops/billing`). New orgs receive a **14-day Team trial** with full Team features. Add a paid Starter or Team plan before the trial ends to keep access.

## 4. Connect a provider key

Open **Vault** (`/ops/vault`). Add at least one provider key (OpenAI, Anthropic, or DeepSeek recommended for v1). Keys are encrypted at rest and never shown again in the UI.

## 5. Run a test prompt

Open **Workbench** (`/ops/workbench`). Choose the provider and model, enter a short prompt, and run. This verifies BYOK and records your first usage.

## 6. Review usage

Open **Usage** (`/ops/usage`). Confirm tokens and cost for the current month. Visiting this page marks the onboarding usage step complete.

## 7. Invite a teammate

Open **Settings** (`/ops/settings`). Send an email invite or copy the invite link when email is not configured. Invites expire after 7 days.

## ASCII flow

```
Register -> /ops/onboarding -> Billing (trial)
    -> Vault (BYOK) -> Workbench (first run)
    -> Usage -> Settings (invite)
```

## Troubleshooting

| Issue | Fix |
|---|---|
| 402 upgrade required | Start trial or subscribe on Billing |
| Workbench missing key | Add provider in Vault first |
| 429 quota exceeded | Upgrade plan or wait for monthly reset |
| Invite email not sent | Set `RESEND_API_KEY` on the server; copy link from Settings |

See [BYOK setup](./byok.md) and [Plans](./plans.md) for detail.
