# Phase 2.10; Tool Allowlisting & Rate Limiting

## Goal
Build Scout's tool allowlisting and rate limiting system. Admins control which tools each tenant can use and how frequently. This prevents abuse, contains compromised accounts, and fulfills the "Tool allowlisting & rate limiting" promise.

## Files to create
```
packages/scout/src/
  allowlisting/
    tool-allowlist.ts; Tool allowlist enforcement
    allowlist-config.ts; Per-tenant allowlist configuration
    allowlist-api.ts; Admin API for managing allowlists
  rate-limiting/
    rate-limiter.ts; Token bucket rate limiter
    rate-limit-config.ts; Per-tenant rate limit configuration
    rate-limit-store.ts; Redis-backed rate limit counters
    rate-limit-api.ts; Admin API for managing limits
```

## Tool allowlisting

### Default allowlist (new tenant)
All tools allowed except:
- `terminal` (blocked by default; security risk)
- `write_file` (blocked by default; can modify system)
- `delete` (blocked by default; destructive)

### Tier-based allowlists
```
FREE tier (10K tokens):
  chat, search, read_file, get_property, get_portfolio_summary

PRO tier (500K tokens):
  + terminal, write_file, email_ingestion, floor_plan_analysis,
  + all property tools, all CRM tools, browser_navigate
  
ENTERPRISE tier (custom):
  + all tools (customizable per tenant)
  + custom tools (domain packs)
```

### Allowlist enforcement
```typescript
class ToolAllowlist {
  isAllowed(tenantId: string, toolName: string): boolean {
    const allowlist = this.getAllowlist(tenantId);
    
    // Check explicit deny
    if (allowlist.denied.includes(toolName)) return false;
    
    // Check explicit allow
    if (allowlist.allowed.includes(toolName)) return true;
    
    // Check wildcards
    for (const pattern of allowlist.wildcards) {
      if (matchWildcard(toolName, pattern)) return true;
    }
    
    // Default: deny
    return false;
  }
}
```

### Admin API
```typescript
// Get allowlist for tenant
GET /api/admin/scout/allowlist/{tenantId}
{ allowed: ["chat","search","read_file"], denied: ["terminal"], wildcards: ["property_*"] }

// Update allowlist  
PUT /api/admin/scout/allowlist/{tenantId}
{ allowed: ["chat","search","read_file","terminal"] }

// Bulk update by tier
PUT /api/admin/scout/allowlist/bulk
{ tier: "PRO", allowed: ["chat","search","...","terminal","write_file"] }
```

## Rate limiting

### Rate limit types
```
Per tool:
  chat:         60 requests/minute
  terminal:     10 requests/minute
  search:       20 requests/minute
  write_file:    5 requests/minute

Per tenant:
  Total API calls:  120 requests/minute
  Total tokens:     500,000/month (Pro tier)
  
Per IP:
  Auth attempts:    5 attempts/minute (brute force prevention)
  API calls:        60 requests/minute
```

### Token bucket algorithm
```typescript
class TokenBucket {
  capacity: number; // Max tokens in bucket
  refillRate: number; // Tokens added per second
  tokens: number; // Current token count
  lastRefill: Date;
  
  consume(count: number = 1): boolean {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    return false; // Rate limited
  }
}
```

### Rate limit response
```json
{
  "error": "rate_limited",
  "message": "Rate limit exceeded. 60 requests/minute allowed. Retry in 3 seconds.",
  "retry_after": 3,
  "limit": 60,
  "remaining": 0,
  "reset_at": "2026-06-07T14:33:00Z"
}
```

### Progressive rate limiting
```
1st violation: 429 response + retry-after header
5th violation in 1h: 429 + 1 minute cooldown
10th violation in 1h: 429 + 5 minute cooldown + LOW alert to dashboard
20th violation in 1h: block tenant for 30 minutes + MEDIUM alert + Telegram
```

## Verification
```bash
# 1. Test tool allowlist
curl -X POST /api/chat/send -d '{"message": "run: ls -la"}' 
# Expected: "Tool 'terminal' is not available on your plan. Upgrade to PRO."

# 2. Test rate limit
for i in {1..61}; do curl -X POST /api/chat/send -d '{"message":"test"}'; done
# Expected: 60 successful, 61st returns 429 with retry-after

# 3. Test progressive
# Send 11 requests over limit within 1 hour
# Expected: 5th = 1min cooldown, 10th = 5min cooldown + alert, 11th = blocked

# 4. Test tier upgrade
# Change tenant from FREE to PRO
# Expected: terminal now available
```
