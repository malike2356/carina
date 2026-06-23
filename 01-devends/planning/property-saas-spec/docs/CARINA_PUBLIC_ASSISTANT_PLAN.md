# Carina as Public-Facing Paid Assistant - Plan & Architecture

**Date:** 2026-05-26
**Session:** Extended brainstorming on Carina standalone public assistant
**Participants:** Laud, Malike

---

## Core Concept

Expose Carina as a standalone paid AI assistant to the public. A user signs up, pre-pays for tokens (minimum £5), and uses Carina for domain-specific help. When tokens run out, they buy again. No subscription required - pure pay-as-you-go, DeepSeek-style.

The same account sits on Propreneur's auth system, creating a path for future upsell to the full Propreneur OS. But a user does not need to commit to Propreneur to use Carina.

---

## Why This Works

### Strategic Upside

1. **Funnel into Propreneur.** Someone pays £5 to try Carina. They get good results. Eventually they hit a wall - "can Carina draft my BDAs? manage investor pipeline?" That's the upsell moment. Standalone Carina becomes a low-friction acquisition channel for full Propreneur.

2. **Volume over ticket size.** £5 minimum means anyone can try. Students, casual users, property newbies. 100 users at £5 = £500. 1,000 = £5k. 10,000 = £50k. The math scales with reach, not ticket size.

3. **Domain-specific moat.** OpenAI/Grok/Claude are general-purpose. Carina is built for property entrepreneurs - deal analysis, compliance, investor messaging, calculators. That depth is something general models can't replicate out of the box.

---

## Pricing Model (DeepSeek-Inspired, +5% Margin)

**Base pricing mirrors DeepSeek's API pricing.** A small margin (~5%) is added on top to cover:

- Infrastructure costs (VPS, scaling)
- Payment processing fees (Stripe)
- Platform overhead

This keeps pricing competitive while ensuring the platform is self-sustaining from day one.

### Minimum Bundle

- **£5 minimum** - low enough that anyone can try
- Tokens never expire (DeepSeek model)
- Top-up any time, any amount

### Token Packs (Suggested)

| Pack | Price | Tokens | Effective Cost/Token |
|---|---|---|---|
| Micro | £5 | (based on DeepSeek + 5%) | Lowest entry point |
| Starter | £10 | ~5,000 | Testing/prototyping |
| Growth | £50 | ~30,000 | Small projects |
| Scale | £200 | ~150,000 | Regular usage |
| Enterprise | £500+ | Custom | Heavy users |

*Exact token counts to be calculated once DeepSeek V4 Flash pricing is confirmed.*

---

## Multi-LLM Backbone - Provider by Use Case

Carina uses **multiple AI providers** as backbone, not a single model. Each provider is matched to the use case it excels at:

| Provider | Use Case | Why |
|---|---|---|
| **DeepSeek V4 Flash** | General text, property Q&A, deal analysis | Cheapest by far (~£0.14/M tokens). Default for everything text. Most users will only ever touch DeepSeek. |
| **Grok (xAI)** | Voice / Whisper processing | Voice transcription and voice interaction. Burns more tokens than text due to higher cost. |
| **OpenAI (DALL-E / GPT-4o)** | Image generation (nanobanana, property visuals) | Best-in-class image gen. Burns significantly more tokens than text. |
| **Anthropic (Claude)** | Persistent high-level calculations, advanced reasoning *(optional)* | Most expensive but best for complex multi-step reasoning. |

**For 90%+ of users:** Everything routes through DeepSeek. Voice, image, and advanced reasoning are premium paths that cost more tokens.

---

## Token Burn Rates - Provider-Aware Metering

**Not all queries cost the same.** Token burn varies by provider, because each provider has different API costs.

| Interaction | Backend Provider | Token Burn (Multiplier) |
|---|---|---|
| Text Q&A (default) | DeepSeek V4 Flash | 1.0× base rate |
| Text Q&A (voice-transcribed) | DeepSeek | 1.0× (transcription billed separately via Grok) |
| Voice interaction / Whisper | Grok | ~3-5× base rate |
| Image generation (1 image) | OpenAI DALL-E | ~20-50× base rate (one image = thousands of text tokens) |
| Advanced calculation / reasoning | Anthropic Claude | ~3-5× base rate |
| Tool use / function calling | DeepSeek | 1.0× (same as text) |

**Logic:** Each interaction is priced in platform tokens proportional to the real cost of serving it. If Grok costs 3× more per call than DeepSeek, the user burns 3× more tokens. If DALL-E costs more per image than 50K text tokens, they burn 50K tokens.

**User sees a simple balance:** "You have X tokens remaining." The meter handles the complexity behind the scenes.

---

## BYOK (Bring Your Own Key) - Images & Deal Packs

Users have **two paths** for premium operations (images, deal packs):

### Path 1: Platform Tokens (Default)
User burns their Carina tokens. The platform handles the API call, token deduction, and billing. This is the simplest path - pay once, use freely. Images and packs are more expensive in terms of token burn, but it's frictionless.

### Path 2: BYOK (Alternative)
User brings their own API key (OpenAI, Anthropic, etc.) for images and deal pack generation. **Platform tokens are NOT consumed** for these operations - the user's own API key is billed directly by the provider.

This is ideal for:
- Power users who already have OpenAI credits
- Users who want higher-quality image generation without burning through Carina tokens
- Developers and property professionals integrating Carina into their existing toolchain

**Platform tokens remain for:** All text-based interactions (Q&A, deal analysis, mentoring, compliance checks, etc.) routed through DeepSeek.

### Deduction Order

When a user has both platform tokens and a BYOK configured:

```
1. Text / chat → deduct from platform tokens (DeepSeek backend)
2. Image generation → use BYOK if configured, otherwise deduct from platform tokens (at higher burn rate)
3. Deal pack generation → same as images: BYOK preferred, fallback to platform tokens
```

---

## Free Tier (Growth Engine)

Even limited free access can drive adoption. Pattern from DeepSeek and ChatGPT:

| Tier | Tokens | Limit |
|---|---|---|
| **Free** | ~1,000 free tokens on signup | Enough to try Carina on a few property queries. No voice, no images. |
| **Paid** | £5+ | Full access, all providers, BYOK support. |

Free tier is a taste. After the initial allotment, users need to buy tokens to continue.

---

## Account Architecture

### Tenancy and Auth
- Account lives on Propreneur's auth system (centralised user model)
- Carina-only user = limited role with zero visibility into Propreneur admin features
- Clean separation of concerns, shared identity layer
- If user upgrades to full Propreneur, transition is seamless - same email, same account, elevated role

### Upgrade Path
```
Carina-only user (paid tokens)
    │
    ├── Option 1: Stay on Carina standalone (pay-as-you-go)
    └── Option 2: Upgrade to full Propreneur
            │
            ├── Existing Carina tokens roll over
            ├── New Propreneur features unlocked
            └── Can still use Carina the same way + more
```

### Account Portability Requirements
- Shared auth database
- Role-based access control (Carina-only ↔ Propreneur-enabled)
- Token balance persists across upgrade
- SSO-ready for future integrations

---

## UX / Landing

- Separate landing page from Propreneur's main site
- Options: `carina.propreneur.co.uk` or dedicated domain
- Clean, focused experience: sign up, pay, chat
- Should feel like a product in its own right, not a side feature
- Token balance visible in the chat interface (simple counter)
- One-click top-up from anywhere in the UI

---

## Open Questions for Next Session

1. What is DeepSeek V4 Flash's actual per-million-token pricing? (Confirm and compute 5% margin)
2. What is Grok's whisper/voice pricing to determine the token burn multiplier?
3. What's the exact cost mapping per provider interaction?
4. Should the minimum bundle be £5 or £10? (Balance entry barrier vs. payment processing fees)
5. How does the BYOK flow work in the UI? (Input field? Check on image generation?)
6. Should there be a monthly subscription option as well, or strictly pay-as-you-go?
7. Free tier - 1,000 tokens enough to demonstrate value?
8. Landing page - subdomain or dedicated domain?
9. Payment flow - Stripe, how seamless can we make the £5 top-up experience?

---

## Related Documents

- `architecture/PREPAID_TOKENS.md` - Existing non-expiring token spec (currently assumes £10 minimum, subscription-first)
- `architecture/BILLING_USAGE_METERING.md` - Existing 564-line billing/metering spec (Cursor-style tiers, subscription model)
- `architecture/PROVIDER_ROTATION.md` - Existing 406-line provider rotation spec (cost-priority, health checks, circuit breakers)
- `architecture/100-REVENUE-OPPORTUNITIES.md` - 100 revenue streams mapped out

---

## Next Steps

- [ ] Confirm DeepSeek V4 Flash API pricing → calculate 5% margin bundle sizes
- [ ] Map token burn multipliers for each provider (DeepSeek, Grok, OpenAI, Anthropic)
- [ ] Design BYOK input flow (settings page, per-image override)
- [ ] Update PREPAID_TOKENS.md with £5 minimum and pure-paygo model
- [ ] Update BILLING_USAGE_METERING.md with provider-aware token burn rates
- [ ] Update PROVIDER_ROTATION.md to include Grok and BYOK override
- [ ] Sketch the Carina-only → Propreneur upgrade path
- [ ] Draft the token balance widget UI spec
