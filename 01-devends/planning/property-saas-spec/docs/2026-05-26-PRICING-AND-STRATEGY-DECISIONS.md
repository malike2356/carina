# Carina AI - Pricing & Strategy Decisions

**Date:** 26 May 2026
**Session:** Research, analysis, and final pricing decisions
**Participants:** Laud, Malike
**Status:** Final decisions recorded - ready for implementation

---

## 1. Research Summary - Provider API Pricing (May 2026)

### DeepSeek (Primary Text Provider)

| Metric | V4 Flash | V4 Pro |
|---|---|---|
| Input per 1M tokens | $0.14 (~£0.11) | $2.18 (~£1.72) |
| Output per 1M tokens | $0.28 (~£0.22) | $8.72 (~£6.89) |
| Cache hit input | $0.0028/M (98% off) | $0.0145/M |
| Context window | 1M tokens | 1M tokens |
| Max output | 384K tokens | 384K tokens |

- 5 million free tokens on signup, no credit card required
- Automatic context caching
- Up to 99% cheaper than GPT-5.5

### Grok / xAI (Secondary Provider)

**Important:** Grok 4.1 Fast ($0.20/$0.50) was retired 15 May 2026. All old slugs now redirect to Grok 4.3 pricing.

| Model | Input per 1M | Output per 1M |
|---|---|---|
| Grok 4.3 (flagship) | $1.25 (~£0.99) | $2.50 (~£1.98) |
| Grok 4.20 (all variants) | $1.25 | $2.50 |
| Grok Build 0.1 (coding) | $1.00 | $2.00 |
| Cached input | $0.20 (85% off) | - |

- $5/1K calls for web/X search, $5/1K for code execution
- **Voice:** xAI does NOT publish a separate Whisper/voice API. The plan's assumption to use Grok for voice is incorrect. Will use OpenAI Whisper ($0.006/min) or Deepgram for speech-to-text, and whichever provider offers best voice capabilities for voice interaction.

### OpenAI (Image Generation + Voice)

| Model | Input per 1M | Output per 1M |
|---|---|---|
| GPT-4o | $2.50 (~£1.98) | $10.00 (~£7.90) |
| GPT-4o mini | $0.15 (~£0.12) | $0.60 (~£0.47) |
| DALL-E 3 (1 image) | - | ~£0.04-0.08 |
| Whisper (voice) | $0.006/minute | - |

### Anthropic (Optional - Advanced Reasoning)

| Model | Input per 1M | Output per 1M |
|---|---|---|
| Claude Sonnet 4 | $3.00 (~£2.37) | $15.00 (~£11.86) |

### Provider Cost Comparison - Per Query

For a typical property Q&A (500 input tokens + 300 output tokens):

| Provider | Cost per query |
|---|---|
| **DeepSeek V4 Flash** | **~£0.00017** |
| Grok 4.3 | ~£0.0015 |
| GPT-4o | ~£0.0039 |
| Claude Sonnet 4 | ~£0.0058 |

DeepSeek is **9x cheaper than Grok** and **18x cheaper than GPT-4o** for output. For 90%+ of text queries, DeepSeek V4 Flash is the default and the cost is near-zero.

---

## 2. COGS Analysis - Why Tokens Cost Us Almost Nothing

### Raw Unit Economics

| Item | Cost |
|---|---|
| DeepSeek V4 Flash, 1,000 input tokens | £0.00011 |
| DeepSeek V4 Flash, 1,000 output tokens | £0.00022 |
| Typical Q&A (500 in / 300 out) | **£0.00013** |
| Stripe fee on £5 transaction | **~£0.27 (5.4%)** |
| Stripe fee on £10 transaction | ~£0.34 (3.4%) |
| Stripe fee on £20 transaction | ~£0.48 (2.4%) |

### What £5 Buys at Cost

- At DeepSeek V4 Flash pricing, £5 covers roughly **38 million input tokens** or **19 million output tokens**
- That's approximately **35,000-40,000 typical Q&A conversations**
- The token cost is negligible - real costs are infrastructure (VPS, Redis, Postgres)

### Conclusion on 5% Margin Logic

The original plan assumed "DeepSeek + 5% margin" pricing. This was naive for a product:

- At cost+5%, £5 would give ~29 million tokens - unrealistically large and confusing for users
- The 5% margin concept works for an API reseller but not for a product with its own value prop
- **Carina's value is in property-specific knowledge, tool access, convenience, and curation - not in token arbitrage**
- Token pricing is a product decision (what feels valuable to the user), not a cost pass-through

---

## 3. Final Pricing Decisions

### Free Tier

| Tier | Tokens | Cost to Carina | Value to User |
|---|---|---|---|
| **Free** | **2,500,000 tokens** | ~£0.43 | ~2,500 Q&A conversations |

- **Rationale:** DeepSeek offers 5M tokens free on signup. Carina free tier offers **exactly half** of what DeepSeek gives.
- Enough to demonstrate value across multiple property scenarios
- No voice, no image generation, no priority queue
- No credit card required

### Pay-As-You-Go (Token Packs)

| Pack | Price | Tokens | Effective per conversation | Est. Cost to Serve |
|---|---|---|---|---|
| **Micro** | **£5** | **50,000** | ~£0.10 | ~£0.009 |
| Starter | £10 | 120,000 | ~£0.08 | ~£0.021 |
| Growth | £50 | 650,000 | ~£0.08 | ~£0.11 |
| Scale | £200 | 3,000,000 | ~£0.07 | ~£0.52 |
| Enterprise | £500+ | Custom | Custom | Custom |

- Tokens **never expire**
- Minimum top-up: **£5**
- Preset packs available at **multiples of £5**
- All token values are net of a comfortable margin (95%+ gross margin on Micro, improving on larger packs)
- Token burn is provider-aware: voice queries burn more tokens, images burn more tokens, text (DeepSeek) is the baseline

### Subscription Tiers

| Tier | Price | Monthly Tokens | Sweeteners | Annual Price (25% off) |
|---|---|---|---|---|
| **Pro Monthly** | **£19.99/mo** | **200,000** | Priority queue, no rate limits, faster responses | **£179.91/yr (£15/mo equiv)** |

**Subscription sweeteners included with Pro:**
- Priority AI processing queue (faster response times)
- No rate limits (unmetered concurrent requests within fair use)
- Access to higher token burn ceiling for voice/image operations
- Early access to new features
- Priority support

**Annual discount:** 25% off - pay for 9 months, get 12. Annual Pro = £179.91/yr.

**Subscription token rollover:** Unused tokens roll over up to a maximum of 400,000 tokens (2 months' cap).

### Comparison: PAYG vs Subscription per £1

| Option | Tokens per £1 | Best for |
|---|---|---|
| PAYG £5 (Micro) | 10,000 tokens/£ | Casual users, try before committing |
| Pro Monthly £19.99 | 10,005 tokens/£ | Daily users who want priority + no limits |
| Annual Pro £179.91 | 13,340 tokens/£ | Committed users, best value |

The subscription isn't about better token-per-pound value (they're roughly equal). The subscription value is in:
- **Priority queue** - faster responses when Carina is busy
- **No rate limits** - power users can hammer the API as much as they want
- **Consistency** - predictable monthly cost for daily users

---

## 4. Voice Provider Decision

**Decision:** Carina will use whichever provider offers the best voice capabilities, **not specifically Grok**.

- Grok/xAI does not publish a separate Whisper/voice transcription API
- **OpenAI Whisper** ($0.006/min) is the leading option for speech-to-text
- **Deepgram** is an alternative with competitive pricing
- For voice interaction (TTS): ElevenLabs, OpenAI TTS, or Google Cloud TTS
- Final voice provider selection to be made during implementation based on:
  - Quality (accuracy, naturalness)
  - Cost per minute
  - Latency
  - Ease of API integration

---

## 5. Provider Stack Decision

| Capability | Default Provider | Fallback Provider | Token Multiplier |
|---|---|---|---|
| **Text Q&A (90%+ of queries)** | **DeepSeek V4 Flash** | Grok 4.3 | 1x (baseline) |
| **Advanced reasoning** | Anthropic Claude | GPT-4o | 5x |
| **Voice transcription (STT)** | OpenAI Whisper | Deepgram | TBD per minute |
| **Image generation** | OpenAI DALL-E 3 | Stable Diffusion | 50x |
| **Voice interaction (TTS)** | ElevenLabs | OpenAI TTS | TBD per minute |

DeepSeek V4 Flash is the default for 90%+ of all queries. Premium providers are only used when the task specifically requires them (images, complex reasoning, voice).

---

## 6. Domain Decision

**Decision:** Use the dedicated domain already purchased. Point it at the same VPS as Propreneur.

- Dedicated domain gives Carina standalone brand identity
- Nginx virtual hosts on the same VPS = zero additional cost
- Shared auth infrastructure is still possible via API
- Brand independence and exit optionality preserved
- SEO independence from Propreneur

---

## 7. BYOK Decision

**Decision:** Defer to v2. Not a launch feature.

- Nice-to-have for power users but <5% will use it
- Adds UX complexity (API key management, two-tier billing)
- Increases support burden ("my image didn't work - is it Carina or my API key?")
- Ship standalone Carina without BYOK first, add when power users request it

---

## 8. Stripe Implementation - Payment Intents for PAYG

**Architecture for pay-as-you-go token top-ups:**

1. User selects pack (£5, £10, £50, £200, or custom amount at £5 increments)
2. Frontend sends request to Laravel backend: `POST /api/billing/create-topup`
3. Backend creates Stripe PaymentIntent:
   ```php
   $intent = PaymentIntent::create([
       'amount' => 500, // £5 in pence
       'currency' => 'gbp',
       'metadata' => [
           'user_id' => $user->id,
           'type' => 'token_topup',
           'pack' => 'micro' // or starter, growth, scale, custom
       ]
   ]);
   ```
4. Backend returns `client_secret` to frontend
5. Frontend completes payment using Stripe.js
6. Stripe fires `payment_intent.succeeded` webhook to Carina backend
7. Webhook handler:
   - Verifies Stripe signature
   - Extracts `user_id`, `pack` from metadata
   - Credits token balance using the pack's token amount
   - Logs transaction with Stripe PaymentIntent ID (idempotency key)
   - Returns 200 OK to Stripe (if webhook retries, check PI ID already processed)
8. User sees updated token balance in Carina UI

**For subscriptions:**
- Use Stripe Subscriptions API with `price_xxx` for £19.99/mo
- Monthly webhook `invoice.paid` credits 200,000 tokens
- Annual webhook credits 200,000 tokens × 12 = 2,400,000 tokens upfront
- Stripe Customer portal for plan management (upgrade, cancel, payment methods)

---

## 9. Open Questions Resolved

| Question | Decision |
|---|---|
| Minimum bundle? | £5 confirmed. Good for conversion despite 5.4% Stripe fee. |
| DeepSeek V4 Flash pricing? | $0.14 input / $0.28 output per 1M tokens. Confirmed. |
| Grok voice pricing? | xAI doesn't publish voice API. Using OpenAI Whisper instead. |
| Minimum bundle across all providers? | £5 at 50,000 tokens. Margin is 95%+ even at Micro. |
| Pay-as-you-go vs subscription? | **Both.** PAYG for casual, subscription for power users. |
| Dedicated domain or subdomain? | **Dedicated domain.** Already owned. Point at same VPS. |
| 1,000 tokens in GBP? | DeepSeek input = £0.00011. Output = £0.00022. Essentially zero. |
| BYOK for Carina? | **v2 feature.** Skip for launch. |
| Stripe Payment Intent flow? | Documented above. Simple: create PI → user pays → webhook credits tokens. |
| Offer subscription? | **Yes.** £19.99/mo Pro with priority queue, no rate limits, faster responses. |
| Is £5 a good idea? | **Yes.** DeepSeek's minimum is effectively £0 (5M free + prepaid credits). £5 clears Stripe fees, converts well, and COGS is negligible. |

---

## 10. Complete Pricing Table (Final)

| Offering | Price | Tokens | Key Features |
|---|---|---|---|
| **Free** | £0 | 2,500,000 (one-time) | Text-only. No voice. No images. Standard queue. Rate limited. |
| **Micro** | £5 | 50,000 | Tokens never expire. Full access. Multi-provider. |
| **Starter** | £10 | 120,000 | Same as Micro. Better per-token value. |
| **Growth** | £50 | 650,000 | For regular users. |
| **Scale** | £200 | 3,000,000 | Heavy users. |
| **Enterprise** | £500+ | Custom | Volume pricing, SLA, white-label options. |
| **Pro Monthly** | £19.99/mo | 200,000/mo | Priority queue. No rate limits. Faster responses. Tokens rollover up to 400K. |
| **Pro Annual** | £179.91/yr | 200,000/mo | Same as Pro Monthly. 25% discount (£15/mo equivalent). |

**Token burn multipliers (provider-aware):**
- Text Q&A (DeepSeek V4 Flash): 1x
- Advanced reasoning (Claude/GPT-4o): 5x
- Voice transcription (Whisper): billed per minute (not token)
- Image generation (DALL-E): 50x per image

The user only sees their token balance. The meter handles the complexity behind the scenes.

---

## 11. Next Steps

- [ ] Build standalone Carina Laravel app (extract from Propreneur)
- [ ] Implement Stripe Payment Intents for PAYG top-ups
- [ ] Implement Stripe Subscriptions for Pro Monthly/Annual
- [ ] Build token balance tracking and UI widget
- [ ] Design landing page for dedicated domain
- [ ] Implement provider-aware token burn metering
- [ ] Integrate OpenAI Whisper for voice (not Grok - see decision above)
- [ ] Set up Nginx virtual host for dedicated domain pointing to same VPS
- [ ] Build free tier signup flow with 2.5M token credit
- [ ] Add subscription cancellation flow with token rollover handling
