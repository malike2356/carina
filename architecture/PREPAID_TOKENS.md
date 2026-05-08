# Carina AI — Prepaid Non-Expiring Tokens (DeepSeek Model)

---

## The Model

DeepSeek lets users buy tokens that **never expire**. You pay once, use them at your pace, run out, buy more. No monthly commitment. No subscription. No expiry anxiety.

Carina should offer the same for API-only users.

---

## Why This Works For Carina

### For the User

| Pain Point | Prepaid Tokens Solve It |
|---|---|
| "I don't want another monthly subscription" | Buy once. Use for months. No recurring charge. |
| "I'm just prototyping, not ready to commit" | £10 gets you 5,000 tokens. Try the API. Upgrade when you're ready. |
| "I don't know how much I'll use next month" | No need to predict. Buy what you need, when you need it. |
| "My usage is seasonal" | Buy £50 worth in January for a project. Use £20. Keep £30 for March. |
| "I hate invoices for £2.50" | Buy £50 once. One invoice. Many API calls. |

### For the Platform

| Benefit | Why It Matters |
|---|---|
| **Upfront cash** | User pays today for usage that might happen months from now. Cash flow positive. |
| **No churn on credits** | Someone who bought £200 of tokens is £200 retained regardless of monthly activity. |
| **Lower billing overhead** | One Stripe payment, not recurring subscriptions for API-only users. Fewer webhooks, fewer failed payment retries. |
| **Enterprise procurement** | Companies prefer one-time purchases ("£500 for API credits") over monthly subscriptions. Easier PO approval. |
| **Upsell path** | £10 → £50 → £200 → £500 → eventually subscribe for UI features when they need more. |
| **Deferred revenue** | Prepaid tokens are deferred revenue on the books. Good for financial reporting. |
| **Price anchoring** | £10 for 5K tokens makes the £20/mo Pro plan (50K tokens + full UI) look like a great deal. |

---

## Pricing Structure

### Token Packs (Non-Expiring)

| Pack | Price | Tokens | Price per 1K Tokens | Best For |
|---|---|---|---|---|
| Micro | £10 | 5,000 | £2.00 | Testing, prototyping |
| Starter | £50 | 30,000 | £1.67 | Small project |
| Growth | £200 | 150,000 | £1.33 | Production app |
| Scale | £500 | 500,000 | £1.00 | High-volume app |
| Enterprise | £2,000 | 2,500,000 | £0.80 | Large platform |

**Tokens never expire. Use them at any pace. When you run out, buy more.**

### Comparison: Prepaid vs Subscription

| Scenario | Prepaid (API Only) | Subscription (Pro) |
|---|---|---|
| **Prototype (month 1)** | £10 = 5K tokens | £20 = 50K tokens (overkill) |
| **Light usage (6 months)** | £50 = 30K tokens (6K/mo avg) | £120 = 300K tokens (wasted) |
| **Heavy usage (1 month)** | £200 = 150K tokens | £20 = 50K tokens (hit limit, buy top-up) |
| **Production app (12 months)** | £500 = 500K tokens (42K/mo avg) | £240 = 600K tokens (maybe need top-up) |

**Prepaid wins for:** Variable usage, prototyping, seasonal use, budget-conscious developers.  
**Subscription wins for:** Consistent monthly usage, need UI features, want predictable billing.

---

## How It Helps: The Cash Flow Advantage

```
Scenario: 100 API users buy prepaid tokens in Month 1

Each user buys average £100 worth of tokens
    │
    ├── Total revenue: £10,000 (UPFRONT)
    ├── Deferred revenue: £10,000 (on books, recognised as tokens are used)
    ├── Actual usage in Month 1: ~£1,000 (10% of tokens consumed)
    ├── Actual usage in Month 2-6: ~£5,000 (50% consumed)
    ├── Remaining deferred: ~£4,000 (40% still unused)
    │
    └── Compare to subscriptions:
        ├── 100 subscription users at £50/mo = £5,000/mo recurring
        ├── But cancellations eat into it
        └── Prepaid: £10,000 locked in regardless of usage velocity
```

| Metric | Subscription | Prepaid Tokens |
|---|---|---|
| Upfront cash | Low (£5K/mo for 100 users) | High (£10K upfront for 100 users) |
| Revenue predictability | High (recurring) | Medium (usage-based recognition) |
| Churn impact | Immediate (cancel = £0) | Delayed (tokens still unused) |
| Enterprise procurement | Hard (monthly PO) | Easy (one-time PO) |
| User commitment | Low (cancel anytime) | High (already paid) |

---

## Implementation

### Token Pack Purchase Flow

```
User clicks "Buy Tokens"
    │
    ├── Select pack: £10 / £50 / £200 / £500 / £2,000
    ├── Checkout via Stripe Payment Intent (not subscription)
    ├── Tokens added to balance immediately
    ├── Confirmation email with receipt + balance
    └── Tokens available on all API endpoints
```

### Balance Tracking

```php
class PrepaidTokenService
{
    public function getBalance(User $user): int
    {
        // Sum all prepaid purchases minus usage
        $purchased = $user->tokenPurchases()->sum('tokens');
        $used = $user->usageLog()
            ->where('source', 'prepaid')
            ->sum('tokens_charged');
        
        return $purchased - $used;
    }
    
    public function deduct(User $user, int $tokens): bool
    {
        $balance = $this->getBalance($user);
        
        if ($balance < $tokens) {
            return false; // Insufficient balance
        }
        
        // Log usage against prepaid pool
        $user->usageLog()->create([
            'tokens_charged' => $tokens,
            'source' => 'prepaid',
            'deducted_at' => now(),
        ]);
        
        return true;
    }
}
```

### Deduction Order

When a user has both a subscription allowance AND prepaid tokens:

```
1. Deduct from subscription allowance first (they already paid for it this month)
2. If allowance exhausted, deduct from prepaid tokens
3. If no prepaid tokens, prompt to buy more or upgrade
```

### Accounting: Deferred Revenue

```php
// Prepaid token purchases are recorded as deferred revenue
// Revenue is recognised as tokens are used

class RevenueRecognitionService
{
    public function recordTokenPurchase(User $user, int $tokens, float $amount): void
    {
        DeferredRevenue::create([
            'user_id' => $user->id,
            'type' => 'prepaid_tokens',
            'tokens_purchased' => $tokens,
            'amount_paid' => $amount,
            'revenue_recognised' => 0,
        ]);
    }
    
    public function recogniseRevenue(User $user, int $tokensUsed): void
    {
        $purchase = $user->deferredRevenue()
            ->where('type', 'prepaid_tokens')
            ->whereRaw('revenue_recognised < amount_paid')
            ->oldest()
            ->first();
        
        if (!$purchase) return;
        
        $proportion = $tokensUsed / $purchase->tokens_purchased;
        $toRecognise = $purchase->amount_paid * $proportion;
        
        $purchase->increment('revenue_recognised', $toRecognise);
    }
}
```

---

## Files

```php
// config/prepaid-tokens.php
return [
    'packs' => [
        'micro' => ['price_gbp' => 10, 'tokens' => 5_000],
        'starter' => ['price_gbp' => 50, 'tokens' => 30_000],
        'growth' => ['price_gbp' => 200, 'tokens' => 150_000],
        'scale' => ['price_gbp' => 500, 'tokens' => 500_000],
        'enterprise' => ['price_gbp' => 2_000, 'tokens' => 2_500_000],
    ],
    'deduct_order' => ['subscription', 'prepaid', 'top_up'],
    'deferred_revenue_accounting' => true,
];
```

```sql
CREATE TABLE token_purchases (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    pack_slug VARCHAR(50) NOT NULL,
    tokens BIGINT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    stripe_payment_intent_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deferred_revenue (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,         -- 'prepaid_tokens'
    tokens_purchased BIGINT,
    amount_paid DECIMAL(10,2) NOT NULL,
    revenue_recognised DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Summary: Should We Do It?

**Yes.** Non-expiring prepaid tokens:

1. **Lower the barrier to entry** — £10 gets a developer started. No monthly commitment.
2. **Improve cash flow** — Upfront payment for deferred usage. £10K in month 1 vs £5K with subscriptions.
3. **Reduce churn impact** — Prepaid tokens don't cancel. User stops using the API but the revenue is already booked.
4. **Simplify enterprise sales** — "£500 for API credits" is a one-line PO. No monthly invoicing.
5. **Create an upsell ladder** — £10 → £50 → £200 → £500 → £2,000 → subscription (when they need UI).

**Keep both models:** Subscriptions for UI users + consistent API usage. Prepaid tokens for API-only, variable usage, and developers who hate commitments.

**DeepSeek's model works because their API is good enough that people naturally run out and buy more.** Same logic applies to Carina. The API is the product.
