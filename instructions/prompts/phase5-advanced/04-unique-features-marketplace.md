# Phase 5.4; Domain Knowledge + Caching + Event-Driven Alerting + Tool Marketplace

## Domain Knowledge Injection

### Task
Implement framework-level domain knowledge. Unlike prompt-based knowledge (which degrades with context), this is a queryable data layer the agent accesses directly.

### Architecture
```
Agent Query: "Is this property HMO compliant in Portsmouth?"
    |
    v
Domain Knowledge Layer
    |
    +-- UK Property Law DB (SQLite)
    |   - Housing Act 2004
    |   - HMO Management Regulations
    |   - Local council specific rules
    |
    +-- HMO Regulations by Postcode (JSON index)
    |   - Portsmouth: minimum room size 6.51 sqm
    |   - London: additional licensing schemes
    |   - Scotland: different HMO definition
    |
    +-- Live Data Feeds (API)
    |   - Rightmove/Zoopla prices
    |   - Land Registry sold prices
    |   - Mortgage rate comparison
    |
    +-- Static Reference Data
        - UK property investment guides
        - Tax regulations for landlords
        - EPC requirements by property type
```

### Implementation
- Domain data stored as structured files (JSON, SQLite)
- Agent queries via tool: domain_lookup("hmo_minimum_room_size", { postcode: "PO1" })
- Data versioned and updateable independently of Carina Core
- Packaged with domain packs (property-uk includes property law data)

---

## Tool Result Caching

### Task
Implement intelligent caching for tool results. Reduces latency and API costs for repeat queries.

### Cache rules (configurable TTL)
| Data type | TTL | Reason |
|---|---|---|
| Web searches | 1 hour | Results change slowly |
| Property lookups | 24 hours | Portfolio is stable |
| Compliance status | Until expiry date changes | Only changes on renewal |
| Market data | Configurable per source | Rightmove every 30min, Land Registry monthly |
| AI classifications | 1 hour | Same email shouldn't be reclassified |

### Implementation
- Cache layer between tool execution and agent context
- In-memory cache for session, SQLite for cross-session
- Cache key: tool_name + hash(parameters)
- Cache invalidation: TTL-based + manual flush command
- Scout logs all cache hits/misses

---

## Event-Driven Alerting

### Task
Replace poll-based checking with event-driven alerting.

### Event types
| Event | Trigger | Alert |
|---|---|---|
| Rent overdue | Tenant payment 3+ days late | Push notification + Telegram |
| HMO licence expiring | 30 days before expiry | Telegram + email |
| New listing | Rightmove match on saved criteria | Push notification |
| Email from property manager | Marked urgent | Telegram alert |
| Compliance document expired | Expiry date passed | Email + dashboard |
| Maintenance emergency | Issue marked "emergency" | SMS + Telegram |
| Portfolio value change | 5%+ swing | Dashboard notification |

### Implementation
- Database triggers for internal events (PostgreSQL NOTIFY)
- External webhooks for Rightmove, email, etc.
- Polling fallback for sources without push support
- Event bus: Redis pub/sub or simple file-based queue
- Alert routing: severity-based channel selection

---

## Tool Marketplace

### Task
Build a community tool registry where developers can publish, discover, and install tools.

### Features
1. Public registry: anyone can publish a tool
   - Tool manifest validation
   - Automated testing before publish
   - Versioning with changelogs
   - Community ratings and reviews

2. Private registry: enterprise-only
   - Access control per workspace
   - Audit trail for tool installations
   - Approval workflow for new tools

3. One-click install
   - From marketplace to workspace
   - Dependency resolution
   - Automatic compatibility checking
   - Rollback on failure

4. Publishing workflow
   1. Developer creates tool with manifest
   2. Runs validation: carina tool validate
   3. Publishes: carina tool publish
   4. Registry runs automated tests
   5. Tool appears in marketplace

### Registry API
```
GET  /api/v1/tools          - List all tools
GET  /api/v1/tools/{name}   - Tool details
POST /api/v1/tools          - Publish new tool
PUT  /api/v1/tools/{name}   - Update tool version
GET  /api/v1/tools/search   - Search tools
POST /api/v1/tools/install  - Install tool to workspace
```

### Marketplace UI
```
+--------------------------------------------------+
| TOOL MARKETPLACE                        [Search]  |
+--------------------------------------------------+
| Popular | New | Property | Security | Development |
+--------------------------------------------------+
| rightmove-scraper          v1.2.0     (47)  |
| Scrape Rightmove listings matching criteria.      |
| By @laud | Property | Installed 234 times          |
| [Install]                                         |
+--------------------------------------------------+
| hmo-compliance-checker     v2.0.1     (89)  |
| Check HMO compliance by postcode and room sizes.   |
| By @laud | Property | Installed 567 times          |
| [Install]                                         |
+--------------------------------------------------+
```

## Verification
```bash
# Domain knowledge
domain_lookup("hmo_minimum_room_size", { postcode: "PO1 3AB" })
# Expected: { single_occupancy_sqm: 6.51, double_occupancy_sqm: 10.22 }

# Caching
time carina query "What's my portfolio summary?"
# First call: 2s (fresh data)
# Second call: 0.3s (cached)

# Event-driven alerting
# Create overdue rent in DB -> verify push notification fires immediately

# Marketplace
carina tool publish --manifest ./my-tool/manifest.json
carina tool install rightmove-scraper
```
