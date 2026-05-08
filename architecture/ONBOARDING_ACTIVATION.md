# Carina AI — User Onboarding & Activation Flow

**Purpose:** Every signup → first "wow" moment → paid conversion  
**Principle:** Get the user to value as fast as possible. Remove friction at every step.

---

## The Funnel

```
Landing ──► Signup ──► Verify ──► First Chat ──► First Wow ──► Subscribe
  │           │          │           │              │             │
  │        Social     Email        Guided        Area/Deal    Upgrade
  │        or Email   check       prompt        analysis     prompt
```

## Step 1: Landing to Signup

**Friction removed:**
- No credit card required for Free tier or trial
- Social login (Google, GitHub) in addition to email
- One-click: email + password only. No profile details until later

**Signup fields:**
- Email (or OAuth)
- Password (auto-generated for social login)
- Property role: Landlord / Investor / Agent / Developer / Other

**Post-signup:**
- Email verification sent. Allow limited chat (3 messages) before verify.
- Auto-create tenant DB. Seed default knowledge base.
- Redirect to `/welcome`

## Step 2: Welcome & Role Selection

```
/welcome

"Hi, I'm Carina. I'm an AI that knows UK property inside out."

[I'm a Landlord]    [I'm an Investor]    [I'm an Agent]    [I'm a Developer]

(Each role pre-fills different starter questions)

Landlord → "How do I check my property is HMO-compliant?"
Investor → "What's a good yield for a BTL in Birmingham?"
Agent →   "Generate a property listing description"
Developer → "Analyse this development deal"
```

## Step 3: First Conversation

```
Carina: "Let me show you what I can do. Ask me anything about property."
        │
User:   "What's the yield on a property bought for £300k renting at £1,500/mo?"
        │
Carina: [Calculates, shows formatted result]
        "Gross yield: 6%. Here's how that compares to the UK average."

┌──────────────────────────────────────────────┐
│  💡 Try asking me:                            │
│  • "Is this area good for investment?"        │
│  • "Analyse this deal for £200k"              │
│  • "What property laws changed in 2026?"      │
│  • "Upload a PDF and I'll learn from it"      │
└──────────────────────────────────────────────┘
```

## Step 4: Activation Triggers

A user is "activated" when they experience Carina's core value. Track these events:

| Event | Trigger | Activation Signal |
|---|---|---|
| Deal calculation | User asks a deal question | Medium |
| Area report | User requests area analysis | Strong |
| Document upload | User uploads first document | Strong (Pro+ feature) |
| API call | User generates first API key | Very strong (developer) |
| Return visit | User comes back within 7 days | Medium |

**Goal:** Get the user to at least one activation event within the first session.

## Step 5: Upgrade Prompts

Timing: Not immediately. Let the user hit a limit first.

| Trigger | Prompt | Timing |
|---|---|---|
| Hit 5K token limit | "You've used all your free tokens. Upgrade to Pro for 50K tokens/mo." | End of free allowance |
| Try to upload document | "Document upload is available from Pro+ (£60/mo). Upgrade to train Carina on your knowledge." | On upload attempt |
| Try API | "API access is available from Pro (£20/mo). Generate your first API key." | On API key generation |
| 3rd return visit | "You've used Carina 3 times. Pro users get 10x more tokens and area reports." | After 3rd session |
| New feature announcement | "Pro+ now supports portfolio analysis. Upgrade to analyse all your properties at once." | Product launch |

## Free Tier Limits (Conversion Drivers)

| Limit | Value | Purpose |
|---|---|---|
| Tokens | 5,000/mo | Enough for ~10-20 conversations. Shows value, then gates. |
| API calls | 0 | Must upgrade to integrate Carina into workflow. |
| Document upload | 0 | Must upgrade to train Carina. |
| Area reports | 0 | Must upgrade to unlock Carina's full analysis. |
| Chat history | 7 days | Lose history if not active. Incentivises regular use. |

## Trial-to-Paid Funnel Metrics

| Stage | Conversion Rate | Target |
|---|---|---|
| Landing → Signup | 5-10% | Signup friction low |
| Signup → Verified | 70-80% | Email delivery high |
| Verified → First Chat | 90%+ | Guided prompt effective |
| First Chat → Activation | 40-60% | User experiences core value |
| Free → Paid (any) | 5-15% (monthly) | Token limit + feature gates |
| Trial → Pro | 20-30% | Trial converts well |
| Pro → Pro+ | 10-20% | Users hit document/training need |

## Key Implementation Files

```
app/Http/Controllers/Auth/
├── RegisterController.php
├── LoginController.php
├── SocialiteController.php       # Google/GitHub OAuth
└── EmailVerificationController.php

app/Http/Controllers/Web/
├── WelcomeController.php         # /welcome onboarding wizard
└── UpgradePromptController.php   # In-app upgrade modals

resources/views/
├── auth/
│   ├── register.blade.php
│   ├── verify.blade.php
│   └── upgrade-prompt.blade.php
├── onboarding/
│   ├── welcome.blade.php
│   ├── role-selector.blade.php
│   └── first-chat.blade.php

routes/web.php
routes/auth.php
```
