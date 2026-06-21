# Phase 2.17; Pricing + Checkout Flow

## Goal
Build the checkout flow that makes the pricing on carinaai.uk and labyrinthscout.com functional. Users can select a plan, enter payment details via Stripe, and activate their subscription immediately. This turns pricing pages from marketing into revenue.

## Files to create
```
packages/cloud/web/
  pricing/
    index.html; Pricing page (matches carinaai.uk design)
    checkout.html; Stripe Checkout integration
    success.html; Post-payment confirmation
    css/pricing.css
    
packages/cloud/src/
  billing/
    stripe-service.ts; Stripe API integration
    subscription-manager.ts; Plan lifecycle management
    usage-meter.ts; Token usage tracking for billing
    invoice-generator.ts; Invoice generation
    billing-api.ts; REST API for billing operations
    webhooks/
      stripe-webhook.ts; Stripe webhook handler
      
packages/cloud/src/
  api/
    routes/
      billing.routes.ts; Billing API routes
```

## Plans (matching carinaai.uk)

```
┌──────────────────────────────────────────────────────────────┐
│ PRICING                                                       │
├──────────────────┬──────────────────┬────────────────────────┤
│ CARINA CORE      │ LABYRINTH SCOUT │ ENTERPRISE             │
│ Free              │ £99/mo          │ Custom                 │
│ MIT License       │ £79/mo (bundle) │ Dedicated instance     │
├──────────────────┼──────────────────┼────────────────────────┤
│ • Runs locally   │ • Prompt shield  │ • Everything in Scout  │
│ • Bring own keys │ • Moving target  │ • Custom models        │
│ • Open source    │ • Kill switch    │ • SLA guarantee        │
│ • Community      │ • Audit log      │ • SSO integration      │
│                  │ • DLP + egress   │ • Priority support     │
│                  │ • Honeypots      │ • On-premise option    │
│                  │ • Anomaly detect │ • Dedicated account mgr│
├──────────────────┼──────────────────┼────────────────────────┤
│ [Install CLI]    │ [Get Scout →]    │ [Contact Sales →]     │
└──────────────────┴──────────────────┴────────────────────────┘
```

## Checkout flow

### Step 1: Select plan
```
User clicks "Get Scout" → redirects to checkout with plan pre-selected
Plan: Labyrinth Scout Standard; £99/mo
[ ] Carina Bundle; £79/mo (save 20% when used with Carina)
```

### Step 2: Create account
```
Email: [laud@example.com]
Password: [********]
Name: [Laud Paul-Gablah]
Company (optional): [Verlox Ltd]
[Create Account & Continue →]
```

### Step 3: Payment (Stripe Checkout)
```
Stripe-hosted checkout page:
Card number: [4242 4242 4242 4242]
Expiry: [12/28]  CVC: [123]
[Pay £99.00/month]
```

### Step 4: Confirmation
```
┌──────────────────────────────────────────────────────────────┐
│  SUBSCRIPTION ACTIVE                                        │
│                                                               │
│ Plan: Labyrinth Scout Standard                               │
│ Price: £99.00/month                                          │
│ Next invoice: July 7, 2026                                   │
│                                                               │
│ Your Scout API key: scout_live_Xk7M...pQ3w                    │
│                                                               │
│ Quick start:                                                  │
│ $ scout deploy --license-key ***                              │
│ $ carina config set scout.url http://localhost:3001           │
│                                                               │
│ [Go to Dashboard →]  [View Documentation →]                   │
└──────────────────────────────────────────────────────────────┘
```

## Stripe integration
```typescript
class StripeService {
  async createCheckoutSession(planId: string, customerEmail: string): Promise<string> {
    // Returns Stripe Checkout URL
  }
  
  async handleWebhook(event: Stripe.Event): Promise<void> {
    // Handle: checkout.session.completed, customer.subscription.updated,
    //         customer.subscription.deleted, invoice.payment_failed
  }
  
  async getSubscription(customerId: string): Promise<Subscription>;
  async cancelSubscription(customerId: string): Promise<void>;
  async updatePaymentMethod(customerId: string): Promise<string>; // Returns Stripe billing portal URL
}
```

## Billing API
```
GET    /api/billing/subscription; Current subscription details
GET    /api/billing/invoices; Invoice history
GET    /api/billing/invoices/{id}; Invoice PDF download
GET    /api/billing/usage; Current token usage
POST   /api/billing/cancel; Cancel subscription
POST   /api/billing/reactivate; Reactivate cancelled subscription
POST   /api/billing/upgrade; Upgrade plan
GET    /api/billing/portal; Stripe Customer Portal URL
```

## Usage metering
```typescript
// Track token usage for billing
interface UsageRecord {
  tenant_id: string;
  date: Date;
  tokens_used: number;
  model: string;
  cost_estimate: number;
}

// Usage limits (Pro plan: 500K tokens/month)
// Overages: £0.002 per 1K tokens over limit
// Warning at 80%: "You've used 400K of 500K tokens this month"
// Block at 100%: "Token limit reached. Upgrade to continue or wait until {reset_date}"
```

## Verification
```bash
# 1. Access pricing page
open https://carinaai.uk/pricing
# Expected: Free, Scout, Enterprise plans displayed

# 2. Click "Get Scout"
# Expected: redirects to checkout with plan pre-selected

# 3. Complete checkout
# Use Stripe test card: 4242 4242 4242 4242
# Expected: subscription active, API key issued

# 4. Verify subscription
curl -H "Authorization: Bearer ***" /api/billing/subscription
# Expected: { plan: "scout_standard", status: "active", next_invoice: "2026-07-07" }

# 5. Cancel and reactivate
curl -X POST /api/billing/cancel
curl /api/billing/subscription
# Expected: { status: "canceled", ends_at: "2026-07-07" }
curl -X POST /api/billing/reactivate
# Expected: { status: "active" }
```
