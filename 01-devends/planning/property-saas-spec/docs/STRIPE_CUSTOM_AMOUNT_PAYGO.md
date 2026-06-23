# Stripe Billing - Custom Amount Pay-As-You-Go (DeepSeek Model)

**Date:** 2026-05-26
**Context:** Carina standalone public assistant - users enter any amount (minimum £5), prepay, get tokens, use until depleted, buy again.
**Inspiration:** DeepSeek's model. No subscriptions. No price IDs. Pure Payment Intents.

---

## The Flow

```
User enters £15 on carinaai.uk
         │
         ▼
Carina API → Creates Stripe PaymentIntent for £15
         │
         ▼
Stripe returns client_secret → frontend shows card form (Stripe Elements)
         │
         ▼
User enters card → Stripe processes payment
         │
         ▼
Stripe sends webhook: payment_intent.succeeded
         │
         ▼
Carina receives webhook → calculates tokens for £15 → credits user's balance
         │
         ▼
User sees "£15 added. You have X tokens remaining."
```

---

## Stripe Setup Required

### Nothing on Stripe's side except:

| What | How |
|---|---|
| Stripe account | Already exists (live keys in Propreneur `.env`) |
| API keys | Already exist |
| Webhook endpoint | Create in Stripe Dashboard → Developers → Webhooks |
| Webhook URL | `https://carinaai.uk/api/billing/webhook` |
| Webhook events | Subscribe to: `payment_intent.succeeded`, `payment_intent.payment_failed` |
| Webhook signing secret | Copy from Stripe Dashboard → add to Carina's `.env` as `STRIPE_WEBHOOK_SECRET` |

No products. No prices. No subscription config. Payment Intents are dynamic - the amount comes from the user, not a predefined price ID.

---

## The Code Approach

### 1. API Endpoint - Create PaymentIntent

```php
// POST /api/billing/create-payment
public function createPaymentIntent(Request $request)
{
    $amount = $request->validate([
        'amount' => 'required|numeric|min:5|max:10000', // £5 minimum
    ]);

    $stripe = new StripeClient(config('services.stripe.secret'));

    $intent = $stripe->paymentIntents->create([
        'amount' => (int) ($amount['amount'] * 100), // Stripe uses pence
        'currency' => 'gbp',
        'metadata' => [
            'user_id' => auth()->id(),
            'type' => 'carina_token_topup',
        ],
    ]);

    return response()->json([
        'client_secret' => $intent->client_secret,
    ]);
}
```

### 2. Webhook Handler - Credit Tokens on Success

```php
// POST /api/billing/webhook (no auth - Stripe signs it)
public function handleWebhook(Request $request)
{
    $payload = $request->getContent();
    $sig_header = $request->header('Stripe-Signature');
    $endpoint_secret = config('services.stripe.webhook_secret');

    $event = \Stripe\Webhook::constructEvent($payload, $sig_header, $endpoint_secret);

    if ($event->type === 'payment_intent.succeeded') {
        $intent = $event->data->object;
        $userId = $intent->metadata->user_id;
        $amountPaid = $intent->amount / 100; // Convert back from pence

        // Calculate tokens based on pricing
        $tokensToCredit = $this->calculateTokensForAmount($amountPaid);

        // Credit the user's token balance
        UserTokenBalance::updateOrCreate(
            ['user_id' => $userId],
            ['balance' => DB::raw("balance + $tokensToCredit")]
        );

        Log::info("Credited {$tokensToCredit} tokens to user {$userId} for £{$amountPaid}");
    }

    if ($event->type === 'payment_intent.payment_failed') {
        $intent = $event->data->object;
        Log::warning("Payment failed for user {$intent->metadata->user_id}: {$intent->last_payment_error->message}");
        // Could notify user via email
    }

    return response()->json(['status' => 'ok']);
}
```

### 3. Frontend - Amount Input + Stripe Elements

```javascript
// On the "Buy Tokens" page - user types any amount they want
const amount = document.getElementById('amount').value; // e.g., "15"

// Step 1: Create PaymentIntent via Carina's API
const { client_secret } = await fetch('/api/billing/create-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
}).then(r => r.json());

// Step 2: Confirm payment with Stripe Elements
const { error } = await stripe.confirmCardPayment(client_secret, {
    payment_method: { card: cardElement }
});

if (error) {
    showError(error.message);
} else {
    showSuccess('Tokens added to your account!');
    updateBalanceDisplay();
}
```

---

## Token Calculation Formula

The `calculateTokensForAmount` function determines how many platform tokens a user gets for their payment.

### Factors

| Factor | Value | Notes |
|---|---|---|
| DeepSeek V4 Flash cost | ~£0.14 per million input tokens | Cheapest provider, used for 90%+ of interactions |
| Platform margin | 5% | Covers infrastructure, VPS, maintenance |
| Stripe fee | 1.4% + 20p per transaction | UK card processing |
| Provider multipliers | DeepSeek: 1.0×, Grok: ~3-5×, OpenAI: ~20-50× | Applied at token burn time, not at purchase |

### Calculation Logic

```php
function calculateTokensForAmount(float $amountGbp): int
{
    $deepSeekCostPerMillion = 0.14; // £0.14/M tokens (DeepSeek V4 Flash)
    $platformMargin = 0.95; // Keep 5% for infra/fees
    $stripePercent = 0.014; // 1.4% Stripe fee
    $stripeFixed = 0.20; // 20p Stripe fixed fee

    // Step 1: Deduct Stripe processing fees
    $afterStripe = ($amountGbp * (1 - $stripePercent)) - $stripeFixed;

    // Step 2: Deduct platform margin
    $netForTokens = $afterStripe * $platformMargin;

    // Step 3: Convert to tokens at DeepSeek rate
    // (This is the wholesale cost - we can set our sale price higher)
    return (int) ($netForTokens / $deepSeekCostPerMillion * 1_000_000);
}
```

**Example at £5:**
- After Stripe fees: £4.73
- After 5% margin: £4.49
- At DeepSeek pricing: ~32 million tokens wholesale

**Note:** The actual token bundle will have its own pricing (you set the rate, not DeepSeek). The calculation above shows the floor - what it costs you. You'll sell token packs at a higher per-token price to build in margin.

---

## Existing Stripe Infrastructure (Propreneur)

Already in place and reusable:

| Asset | Location | Status |
|---|---|---|
| `stripe/stripe-php ^20.0` | Propreneur `composer.json` | Installed |
| `STRIPE_KEY` | Propreneur `.env` | Live key |
| `STRIPE_SECRET` | Propreneur `.env` | Live secret |
| `STRIPE_WEBHOOK_SECRET` | Propreneur `.env` | Live |
| `StripeService.php` | `app/Services/Billing/StripeService.php` | Working (subscriptions, customers, invoices) |
| `StripeServiceInterface.php` | `app/Services/Billing/Contracts/StripeServiceInterface.php` | Working |
| `StripeSettings.php` | `app/Support/Billing/StripeSettings.php` | Config helper |
| `HandlesStripeBillingCheckoutReturn` | `app/Http/Controllers/Concerns/` | Checkout return handler |

---

## Edge Cases & Notes

### Idempotency
- Payment Intents are naturally idempotent (Stripe handles double-submission)
- Store the Stripe PaymentIntent ID in `token_purchases` table for audit
- Check if PI ID already processed before crediting (defensive, given webhook retries)

### Webhook Reliability
- Stripe retries failed webhooks for up to 3 days
- Webhook handler must be idempotent - store processed PI IDs
- Log everything. If token crediting fails, manual reconciliation is possible.

### Failed Payments
- `payment_intent.payment_failed` fires - log it, notify user, take no action on tokens
- User can retry with a different card

### Refunds
- If user requests refund: process in Stripe Dashboard, manually deduct tokens from balance
- Automated: `POST /api/billing/webhook` can listen for `charge.refunded` and deduct tokens

### Minimum Amount
- £5 minimum enforced server-side (cannot be bypassed by client)
- Stripe's minimum for GBP is £0.30 - £5 is safely above
- Maximum: £10,000 per transaction (Stripe limit for card payments)

### Multiple Currencies
- Start with GBP only (UK market)
- Add EUR/USD when expanding internationally

---

## Database Schema (Token Purchases)

```sql
CREATE TABLE token_purchases (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    amount_paid DECIMAL(10,2) NOT NULL,     -- £15.00
    tokens_credited BIGINT NOT NULL,        -- e.g., 5,000,000
    stripe_payment_intent_id VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',  -- completed, refunded, failed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    refunded_at TIMESTAMPTZ
);

CREATE INDEX idx_token_purchases_user ON token_purchases(user_id);
CREATE INDEX idx_token_purchases_stripe ON token_purchases(stripe_payment_intent_id);
```

---

## Comparison: Propreneur (Subscriptions) vs Carina (Pay-As-You-Go)

| Aspect | Propreneur | Carina Standalone |
|---|---|---|
| Billing model | Monthly/annual subscriptions | One-time prepaid tokens |
| Stripe method | Subscription with price IDs | Payment Intents (custom amount) |
| Minimum commitment | £49/month | £5 (once) |
| User type | Property entrepreneurs (serious) | Anyone (casual + serious) |
| Token expiry | Resets monthly | Never expires |
| Revenue model | Recurring (MRR) | Upfront cash + repeat purchases |
| Stripe products/ prices | Required (Investor £49, Operator £99, Academy) | None needed (dynamic amounts) |

---

## What to Build Next

1. **Stripe webhook endpoint** on Carina's API
2. **Payment intent creation endpoint** (validated, authenticated)
3. **Frontend payment form** with custom amount input
4. **Token balance model + migration** (`user_token_balances` table)
5. **Token purchase model + migration** (`token_purchases` table)
6. **Webhook handler** with Stripe signature verification
7. **Balance display** in Carina's chat UI

---

## Related Documents

- `architecture/BILLING_USAGE_METERING.md` - Full billing spec with provider multipliers, usage dashboard, spending controls
- `architecture/PREPAID_TOKENS.md` - Non-expiring prepaid token model (existing spec, currently £10 minimum)
- `CARINA_PUBLIC_ASSISTANT_PLAN.md` - Overall Carina public assistant strategy
- Propreneur `app/Services/Billing/StripeService.php` - Reference Stripe integration
