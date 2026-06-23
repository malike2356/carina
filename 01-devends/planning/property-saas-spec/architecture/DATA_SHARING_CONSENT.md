# Carina AI - Data Sharing Consent Model

**The act of joining a group IS the consent to share.**

---

## The Architecture: Three Data States

Carina has three data states. Each maps to a user's participation level.

```
SOLO MODE (Default)
    │
    │  User's data: private, tenant-isolated
    │  Carina: answers from platform knowledge + user's personal uploads
    │  Platform: trains from opt-in only
    │  Other users: no access
    │
    ▼
GROUP MODE (Opt-In via Joining)
    │
    │  User's data: shared with group members + Carina + platform (anonymised)
    │  Carina: answers from platform knowledge + group RAG + personal uploads
    │  Platform: trains from anonymised group contributions
    │  Group members: access shared deals, documents, analyses
    │
    ▼
PUBLIC SHARE (Opt-In per Item)
    │
    │  User's data: visible via public link
    │  Anyone with link: view the analysis (no Carina account needed)
    │  Carina: no additional access beyond what's already shared
    │  Platform: no additional training
```

---

## The Consent Flow

```
User signs up → Default state: SOLO
    │
    ├── User stays solo → No data shared. Ever. Private tenant DB.
    │
    └── User joins a group → CONSENT GIVEN
        │
        ├── User sees: "[Group Name] shares property data
        │    among members. Carina uses shared data to improve
        │    analysis for the group. Anonymised data helps
        │    train the platform. [Join] [Cancel]"
        │
        ├── User clicks Join → Consent recorded → Data sharing ON
        │
        └── User leaves group → Data sharing OFF
            ├── Previously shared data remains in group RAG
            │   (removing it would degrade the group's knowledge base)
            └── No new data is shared
```

### What Sharing Means

When a user has data sharing ON (because they're in a group):

| Data Type | Shared With | Purpose |
|---|---|---|
| Deals analysed | Group members + Carina | Group discussion, Carina group analysis |
| Documents uploaded | Group RAG (members + Carina) | Collective knowledge base |
| Questions asked | Group members + Carina | Community answers + Carina learns |
| Portfolio (if shared) | Group members (opt-in per share) | Peer review, benchmarking |
| Usage patterns | Platform (anonymised) | Improving Carina's responses |
| Conversation history | Group members (shared conversations only) | Collaboration |
| Personal details | NOT shared | Never exposed |

### What Sharing Does NOT Mean

| Misconception | Reality |
|---|---|
| "My private chats are visible to the group" | Only explicitly shared conversations. Private chats stay private. |
| "Carina will train on my data for everyone" | Group data improves Carina for the group. Anonymised platform training is aggregate only. |
| "My personal info is exposed" | Username only. No email, no phone, no address. |
| "I can't control what's shared" | Every share is an explicit action (post deal, upload doc, share conversation). |
| "If I leave, my data stays forever" | Previously shared data persists (to protect group knowledge). No new data shared. User can request removal of specific contributions. |

---

## The Consent Record

Every consent action is logged immutably:

```sql
CREATE TABLE data_consent_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,         -- 'opt_in', 'opt_out', 'join_group', 'leave_group',
                                         -- 'share_deal', 'share_document', 'revoke_share'
    group_id UUID,                        -- null if platform-level consent
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Immutable, append-only. No updates, no deletes.
```

---

## Group Data Sharing Agreement

Shown once when a user joins their first group:

```
┌──────────────────────────────────────────────┐
│  Data Sharing Agreement                        │
│                                                │
│  [Group Name] is a shared property             │
│  intelligence group. By joining:               │
│                                                │
│  Done:  Deals you share are visible to members     │
│  Done:  Documents you upload enrich the group RAG  │
│  Done:  Carina uses group data to improve answers  │
│  Done:  Anonymised contributions train the platform│
│                                                │
│  Failed:  Your private chats stay private            │
│  Failed:  Your personal details are never shared      │
│  Failed:  You control what you share, when           │
│                                                │
│  You can leave the group at any time.          │
│  Previously shared data remains (to protect    │
│  the group's knowledge), but no new data.      │
│                                                │
│  [I understand, join group] [Cancel]           │
└──────────────────────────────────────────────┘
```

---

## The Benefit Exchange

| Stakeholder | Give | Get |
|---|---|---|
| **User (group member)** | Shared deal data, documents, insights | Better Carina answers (group RAG), peer network, deal flow |
| **Group** | Collective contributions | Shared intelligence that compounds over time |
| **Carina** | Group data for training (anonymised) | More specialised, more accurate property knowledge |
| **Platform** | Aggregate usage data | Continuous improvement of all models and responses |

**The exchange is fair and transparent.** Users see exactly what they get for what they give. No hidden data harvesting. No "we'll improve your experience" vague language. Specific: "Share a deal → Carina analyses it for the group → group RAG improves → your future questions get better answers."

---

## Privacy Is Not the Barrier - Intent Is

The current Carina privacy model treats every user as a potential privacy risk. That's the wrong frame.

- **Solo users** need full privacy. Their data is their own. Tenant-isolated. Never shared.
- **Group users** have already opted in by joining. Privacy is no longer the concern - data quality is.
- **The barrier was never privacy. It was lack of value exchange.** When users see that sharing their deal data makes Carina smarter for their group, they share willingly.
- **The act of joining a group is the consent mechanism.** No separate toggle. No buried setting. The action IS the permission.

---

## Implementation Rule

```php
class DataSharingService
{
    public function canShareData(User $user): bool
    {
        // User has data sharing ON if they're in at least one group.
        // The act of joining a group IS the consent.
        return $user->groups()->count() > 0;
    }

    public function canAccessGroupRag(User $user): bool
    {
        // Only group members can access and contribute to group RAG.
        return $this->canShareData($user);
    }

    public function recordShare(User $user, string $type, array $metadata): void
    {
        DataConsentLog::create([
            'user_id' => $user->id,
            'action' => "share_{$type}",
            'group_id' => $metadata['group_id'] ?? null,
            'metadata' => $metadata,
            'ip_address' => request()->ip(),
        ]);
    }
}
```

---

## Files

```
app/Services/DataSharingService.php      # Consent + sharing logic
app/Models/DataConsentLog.php            # Immutable consent audit trail
database/migrations/
└── xxxx_create_data_consent_log_table.php
```
