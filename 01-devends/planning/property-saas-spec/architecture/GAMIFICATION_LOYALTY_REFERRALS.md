# Carina AI - Gamification, Loyalty & Referrals

**Not a social media game.** Incentives for property intelligence contribution.

---

## The Principle

Carina's gamification is not about streaks, badges for logging in, or leaderboards for posting frequency. Property professionals don't need another dopamine slot machine.

**We reward quality contributions that improve property intelligence for everyone.**

| Right Behaviour | Wrong Behaviour |
|---|---|
| Sharing a verified deal | Posting for likes |
| Uploading a useful document | Clicking buttons for points |
| Referring a serious investor | Mass inviting random contacts |
| Completing a deal and reporting back | Gaming streaks |
| Helping another user with a genuine answer | Spamming comments |

---

## Part 1: Knowledge Contributions (The Core Loop)

### What Counts as a Contribution

| Action | Value | Why It Matters |
|---|---|---|
| Share a deal analysis | High | Adds verified data to group RAG |
| Upload a document (PDF, guide, template) | High | Directly enriches shared knowledge |
| Answer a community question | Medium | Helps another member, validated by Carina |
| Comment with useful insight | Low | Community value, no data persistence |
| Complete a deal and report outcome | Very High | Closes the loop - validates the analysis |

### Contribution Score

```php
class ContributionScore
{
    public const WEIGHTS = [
        'deal_shared' => 10,
        'deal_completed' => 50,      // reported back that the deal went through
        'document_uploaded' => 15,
        'question_answered' => 5,
        'helpful_comment' => 2,
    ];

    // Quality multiplier (0.0 to 2.0)
    // Carina assesses each contribution for data completeness and accuracy
    public const QUALITY_MULTIPLIERS = [
        'incomplete' => 0.5,
        'basic' => 1.0,
        'detailed' => 1.5,
        'verified' => 2.0,
    ];
}
```

### Contribution Levels

| Level | Score Required | Visual | Perks |
|---|---|---|---|
| 1 - Analyst | 0 |  | Default |
| 2 - Contributor | 50 | ⭐ | Custom flair in community |
| 3 - Specialist | 200 | ⭐⭐ | Early access to new features |
| 4 - Expert | 500 | ⭐⭐⭐ | +10% bonus tokens monthly |
| 5 - Authority | 1,000 |  | +25% bonus tokens, priority Carina response |
| 6 - Fellow | 2,500 |  | Custom Carina persona, direct team access |

### Levels Are Not the Goal

Levels are a **byproduct** of useful contributions. Users should not think about them. They just appear when someone is genuinely adding value. No progress bars. No "you're only 30 points away from the next level" nudges.

---

## Part 2: Token Rewards (Loyalty)

### Earning Bonus Tokens

| Action | Bonus Tokens | Limit |
|---|---|---|
| Daily first chat | 50 | Once per day |
| Deal completed and reported | 1,000 | Per deal |
| Document uploaded and ingested | 200 | Per document, 5/day |
| Referral signup (free) | 500 each | 10/month |
| Referral signup (paid) | 2,500 each | Unlimited |
| Level up | 1,000 × new level | Once |
| Active consecutive months | 5% of monthly allowance | Compounds monthly |

### Active Consecutive Months Bonus

| Months Active | Bonus Tokens |
|---|---|
| 1 | 0 |
| 3 | +5% of monthly allowance |
| 6 | +10% of monthly allowance |
| 12 | +20% of monthly allowance |
| 24 | +35% of monthly allowance |
| 36+ | +50% of monthly allowance |

**Example:** A Pro user (£20/mo, 50K tokens) who has been active for 12 months gets 60K tokens per month. Same price. More value. Loyalty rewarded.

### Token Multiplier by Plan

The higher your plan, the more your contributions are worth:

| Plan | Contribution Weight | Why |
|---|---|---|
| Free | 0.5x | Limited impact, limited incentive needed |
| Pro | 1.0x | Baseline |
| Pro+ | 1.5x | Higher quality contributors expected |
| Ultra | 2.0x | Professional users, professional contributions |
| Enterprise | 3.0x | Organisation-level knowledge contributions |

---

## Part 3: Referral Programme

### How It Works

```
Current user shares referral link
    │
    ├── New user signs up (Free tier)
    │   ├── Referrer gets +500 tokens
    │   └── New user gets +500 tokens (welcome bonus)
    │
    └── New user upgrades to paid plan within 30 days
        ├── Referrer gets +2,500 tokens
        └── Referrer gets +10% of new user's first 3 months (as tokens)
```

### Referral Link

```
carina.verlox.uk/?ref=abc123

- Referrer gets a unique code
- Code is embedded in signup link
- No time limit on the code
- Referrer can track: views, signups, conversions
```

### Referral Dashboard

```
/settings/referrals

Your referral link: carina.verlox.uk/?ref=abc123  [Copy] [Share]

┌──────────────────────────────────────────────┐
│  Referral Stats                               │
│                                              │
│  Link views:         142                      │
│  Signups:            18                       │
│  Paid conversions:   5                        │
│                                              │
│  Tokens earned:      15,500                   │
│  (500 × 18) + (2500 × 5) = 9K + 12.5K        │
│                                              │
│  Recent:                                      │
│  ┌──────────────────────────────────────────┐ │
│  │ Jane D. - Signed up (Free)      +500    │ │
│  │ Tom K. - Upgraded to Pro        +2,500  │ │
│  │ Alex S. - Upgraded to Pro+      +2,500  │ │
│  │ Sarah M. - Signed up (Free)     +500    │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Anti-Spam Measures

| Measure | Why |
|---|---|
| Link must be from active account | Prevents bot referral farms |
| Referred user must complete email verification | Prevents fake signups |
| Paid conversion bonus only within 30 days | Incentivises quality referrals |
| Max 10 free referral bonuses/month | Prevents mass low-quality invites |
| Referral link can be revoked if abused | Admin control |

---

## Part 4: Group Achievements (Collective)

Groups, not individuals, have achievements. This builds **collective knowledge**, not individual competition.

### Group Milestones

| Milestone | Reward for Group |
|---|---|
| 10 deals shared in group | Group knowledge base unlocked |
| 50 deals shared | +20% group token multiplier for 1 month |
| 100 deals shared | Group gets custom Carina persona |
| 20 documents uploaded | Group RAG enabled |
| 500 questions answered | Group gets dedicated analysis queue |
| 10 completed deals reported | Verified group badge on profile |

### Group Badge Display

```
┌──────────────────────────────────────────────┐
│   Birmingham Property Network              │
│                                              │
│  Deal quality: 8.2/10                        │
│  Deals shared: 142                           │
│  Knowledge docs: 34                          │
│  Completion rate: 76%                        │
│                                              │
│  Badges:                                     │
│  Done:  100 Deals                                │
│  Done:  Knowledge Base Active                     │
│   Next: 200 Deals → +20% token bonus      │
└──────────────────────────────────────────────┘
```

---

## Part 5: What Users Actually Get

### Tangible Benefits

| User Action | They Get | Platform Gets |
|---|---|---|
| Share a deal | Carina analyses it + community feedback + contribution score | Rich deal database for RAG |
| Upload a document | Document indexed in group RAG - Carina answers from it | Better knowledge base |
| Complete a deal | +1,000 bonus tokens + completion score | Verified deal outcome data |
| Refer a colleague | +500 tokens (free) / +2,500 tokens (paid) | New user acquisition |
| Stay active 12 months | +20% monthly token bonus | Retention |
| Help a group reach milestone | Collective bonus for all members | Engaged community |

### Non-Tangible But Valuable

| Benefit | What It Means |
|---|---|
| Deal track record | When you share a deal and it completes, that's on your profile. Credibility. |
| Group RAG access | The more you contribute, the smarter Carina is for your group. |
| Early access | High-contribution users get first look at new features. |
| Priority queue | Authority-level users get faster Carina responses. |
| Team access | High-contribution users can escalate issues directly to the Carina team. |

---

## Part 6: What We Do NOT Do

| Common Gamification Tactic | Why We Don't Use It |
|---|---|
| Streaks (consecutive days logged in) | Encourages meaningless engagement. Property is not Duolingo. |
| Leaderboards for post count | Encourages spam, not quality. |
| Badges for "first like received" | Trivial. Adds noise. |
| Points for logging in | Login has no property value. |
| Notifications for "someone viewed your profile" | Privacy violation. No value add. |
| "X people are viewing this deal right now" | FOMO manipulation. Not credible for property. |
| Limited time flash challenges | Property decisions take time. Rushing is dangerous. |

---

## Files

```sql
CREATE TABLE contribution_scores (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    total_score INT DEFAULT 0,
    level INT DEFAULT 1,
    deals_shared INT DEFAULT 0,
    deals_completed INT DEFAULT 0,
    documents_uploaded INT DEFAULT 0,
    questions_answered INT DEFAULT 0,
    helpful_comments INT DEFAULT 0,
    referral_signups_free INT DEFAULT 0,
    referral_signups_paid INT DEFAULT 0,
    consecutive_months_active INT DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referral_codes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    views INT DEFAULT 0,
    signups INT DEFAULT 0,
    paid_conversions INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referral_conversions (
    id UUID PRIMARY KEY,
    referrer_id UUID NOT NULL,
    referred_user_id UUID NOT NULL,
    referred_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'free', 'paid', 'expired'
    bonus_tokens_awarded INT DEFAULT 0,
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Summary

| Programme | User Benefit | Platform Benefit |
|---|---|---|
| **Contribution levels** | Credibility, recognition, priority | Quality deal data for RAG |
| **Token bonuses** | More usage for same price | Retention, active users |
| **Referral rewards** | Free tokens, network growth | Cost-effective acquisition |
| **Group milestones** | Shared benefits for the group | Collective knowledge growth |
| **Loyalty multiplier** | More value over time | Long-term retention |

**The flywheel:**
More quality contributions → richer RAG → better Carina answers → more deal completions → more data → repeat.

No streaks. No leaderboards. No FOMO. Just compounding property intelligence that rewards the people who build it.
