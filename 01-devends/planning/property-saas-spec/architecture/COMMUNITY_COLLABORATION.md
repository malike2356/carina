# Carina AI - Community, Collaboration & Workspace Sharing

**Missed in first pass.** Property is about people. Carina needs to connect them.

---

## The Insight

Property is a **people business first**. Deals happen through relationships. Knowledge is shared through networks. Success comes from community.

Current Carina spec treats every user as an island - one person, one knowledge base, one conversation history. That works for a solo landlord. It fails for:

- **A letting agency** with 5 staff who all need access to the same Carina knowledge base
- **An HMO investor** who wants to share a deal analysis with their business partner
- **A property sourcer** who needs to present a deal pack to an investor client
- **A mentor** who answers mentee questions and wants those answers visible to the mentee
- **A property networking group** (like IPN) where members share insights
- **Two investors** collaborating on a joint venture deal

---

## Feature: Workspaces (Multi-User Teams)

### What

A Carina workspace is a shared tenant with multiple users. All users share the knowledge base, uploaded documents, and conversation history. Individual conversations remain private unless shared.

### User Roles per Workspace

| Role | Access | Actions |
|---|---|---|
| **Owner** | Full | Manage billing, add/remove users, delete workspace, all features |
| **Admin** | Full - except billing | Manage users, manage knowledge base, all features |
| **Member** | Shared | Use knowledge base, create conversations, share with workspace |
| **Viewer** | Read-only | View shared conversations, use knowledge base, no uploads |

### Workspace Features

| Feature | Solo | Team (2-5) | Business (5-20) | Enterprise (20+) |
|---|---|---|---|---|
| Users | 1 | Up to 5 | Up to 20 | Unlimited |
| Shared knowledge base | N/A | Done:  | Done:  | Done:  |
| Shared conversations | N/A | Done:  | Done:  | Done:  |
| Role management | N/A | Done:  | Done:  | Done:  |
| Activity log | Personal | Team-wide | Team-wide | Audit export |

### Pricing

| Plan | Solo Included | Team Add-on | Business Add-on |
|---|---|---|---|
| Free | 1 user | - | - |
| Pro | 1 user | £10/mo per additional user | - |
| Pro+ | Up to 3 users | Included | - |
| Ultra | Up to 10 users | Included | - |
| Enterprise | Unlimited | Included | Included |

---

## Feature: Conversation Sharing

### What

Any conversation can be shared - with a workspace member, a specific person, or publicly via link.

### Share Types

| Type | Recipient Sees | Expiry |
|---|---|---|
| **Workspace** | All workspace members can view | Forever |
| **Direct link** | Anyone with the link (public) | Optional: 24h, 7d, 30d, never |
| **Email share** | Recipient gets an email with a link | 30 days |
| **Embed** | iFrame embeddable on any website | Never |

### Public Share Example

```
// Investor shares a deal analysis with their client
Carina, analyse this deal for 123 Smith Street:
Purchase: £200,000
Refurb: £40,000
Rent: £1,500/mo

→ Carina generates analysis
→ User clicks "Share" → "Create public link"
→ Sends link to client
→ Client sees the analysis (read-only, no Carina access needed)
```

### Use Cases

- **Sourcer → Investor:** Share deal analysis without the investor needing a Carina account
- **Agent → Landlord:** Share compliance report with landlord client
- **Mentor → Mentee:** Share training analysis, review mentee's portfolio
- **Agency → Client:** Share area report with property buyer
- **Team → Team:** Share a joint deal analysis for collaborative decision-making

---

## Feature: Community Feed

### What

A property professionals feed within Carina where users share insights, ask questions, and showcase deals.

### Feed Structure

```
Community
├── Trending          # Popular posts from all users (opt-in)
├── Following         # Posts from people you follow
├── Groups            # Your groups
│   ├── HMO Investors (234 members)
│   ├── Birmingham Landlords (89 members)
│   ├── First-Time Investors (412 members)
│   └── Property Sourcers UK (156 members)
└── Saved             # Your bookmarked posts
```

### Post Types

| Type | Content | Privacy |
|---|---|---|
| **Question** | "Anyone dealt with Manchester HMO licensing recently?" | Public or group |
| **Deal showcase** | Deal analysis shared from Carina | Public or group |
| **Article** | Tip, experience, lesson learned | Public or group |
| **Poll** | "What yield do you target for BTL?" | Public or group |

### Community Features

| Feature | Free/Pro | Pro+ | Ultra | Enterprise |
|---|---|---|---|---|
| Read feed | Done:  | Done:  | Done:  | Done:  |
| Comment on posts | Done:  | Done:  | Done:  | Done:  |
| Join groups | 3 max | 10 max | Unlimited | Unlimited |
| Create groups | Failed:  | Failed:  | Done:  | Done:  |
| Create posts | 5/mo | 30/mo | Unlimited | Unlimited |
| Anonymous posting | Failed:  | Failed:  | Done:  | Done:  |

---

## Feature: Groups / Factions

### What

Interest-based groups within Carina. Like LinkedIn Groups but property-specific and AI-enhanced.

### Group Features

| Feature | Description |
|---|---|
| **Group knowledge base** | Members contribute documents. Shared RAG benefits all members. |
| **Group AI persona** | Group admin tunes Carina's persona for the group's focus area. |
| **Group deals** | Members share deals they've found. Group AI analyses them collectively. |
| **Group Q&A** | Questions asked in the group are answered by Carina + members can chime in. |
| **Group events** | Meetups, webinars, masterminds. Calendar + RSVP. Integrated with viCal. |
| **Sponsorship** | Businesses sponsor groups. "Sponsored by [PropertyData]" shown in group header. |

### Group Examples

| Group | Focus | Example Members |
|---|---|---|
| HMO Investors UK | HMO-specific strategies, licensing, management | 234 |
| First-Time Investors | Getting started, avoiding common mistakes | 412 |
| Property Sourcers | Deal finding, packaging, selling to investors | 156 |
| London Landlords | London-specific compliance, yields, tenant market | 89 |
| Birmingham Property Network | Regional deals, local knowledge | 67 |
| Student Accommodation | PBSA, HMO for students, university towns | 45 |
| Serviced Accommodation | Airbnb, short lets, SA strategy | 78 |
| Developers Forum | Planning, building, project management | 112 |

### Group Monetisation (Platform Revenue)

| Model | Price | What Group Owner Gets |
|---|---|---|
| Free group | £0 | Basic features, up to 50 members |
| Premium group | £19.99/mo | Group RAG, AI persona tuning, 500 members |
| Network group | £49.99/mo | Everything + sponsored posts, 2,000 members |
| Enterprise group | Custom | White-label, API, unlimited members |

---

## Feature: Expert Network (Peer-to-Peer)

### What

Property experts offer paid consultations via Carina. Users book time, pay, and get expert advice alongside Carina's AI analysis.

### Expert Flow

```
1. Expert applies → verified (credentials, portfolio, reviews)
2. Expert sets availability (Cal.com / viCal integration)
3. Expert sets price (£30-200/hr)
4. Bookers browse experts by specialty, rating, price
5. Booking creates a shared Carina workspace for the consultation
6. After session: both parties leave reviews
```

### Expert Types

| Expert | Typical Rate | Example |
|---|---|---|
| HMO Specialist | £80-120/hr | "20 years running HMOs in Manchester" |
| Tax/Accountant | £100-150/hr | "Property tax, capital gains, SDLT optimisation" |
| Solicitor | £150-200/hr | "Leasehold, title issues, compliance" |
| Mentor | £50-100/hr | "Getting started, portfolio building" |
| Developer | £80-150/hr | "Project management, cost control, contractors" |

### Revenue Split

| Party | Share |
|---|---|
| Expert | 80% |
| Carina Platform | 15% |
| Payment processing | 5% |

---

## Feature: Deal Marketplace

### What

Property sourcers post deals. Investors browse and express interest. Carina facilitates the match.

### Sourcer Flow

```
1. Carina analyses the deal (automatic when entered)
2. Sourcer sets: finder's fee (£2K-£5K), exclusivity period (7-30 days)
3. Carina matches to suitable investors based on criteria
4. Investor expresses interest → Sourcer gets notified
5. Investor pays finder's fee through Carina (escrow)
6. Carina releases full deal details
```

### Monetisation

| Party | Share |
|---|---|
| Sourcer | 90% of finder's fee |
| Carina Platform | 10% of finder's fee |

---

## Files

```
app/Models/
├── Workspace.php              # Multi-user tenant
├── WorkspaceMember.php        # User-role within workspace
├── CommunityPost.php          # Community feed posts
├── CommunityGroup.php         # Interest groups
├── GroupMembership.php        # User-group membership
├── SharedConversation.php     # Shared conversation links
└── ExpertProfile.php          # Expert network profiles

app/Services/
├── Community/
│   ├── FeedService.php        # Feed generation, trending algorithm
│   ├── GroupService.php       # Group CRUD, membership
│   └── ExpertMatchService.php # Expert search + booking
├── Workspace/
│   ├── WorkspaceService.php   # Team management
│   └── SharingService.php     # Conversation sharing + permissions

database/migrations/
├── xxxx_create_workspaces_table.php
├── xxxx_create_community_tables.php
└── xxxx_create_expert_profiles_table.php

resources/views/
├── community/
├── workspace/
├── experts/
└── shared/

routes/web.php
routes/api.php
```
