# Phase 2.13; Egress Filtering & DLP (Data Loss Prevention)

## Goal
Build Scout's egress filtering; the last line of defense before data leaves the agent. Every outbound message is scanned for sensitive patterns (API keys, passwords, PII, internal IPs). Detected data is redacted or blocked. This fulfills "Egress Filtering & DLP" on both websites.

## Files to create
```
packages/scout/src/
  egress/
    egress-filter.ts; Main egress scanning pipeline
    pattern-detector.ts; Regex + ML pattern matching
    redactor.ts; Safe redaction of detected data
    sensitive-patterns.json; Pattern library (API keys, PII, IPs)
    egress-config.ts; Per-tenant DLP rules
    egress-audit.ts; Logs every egress event
```

## What gets scanned

### 1. API keys and credentials
```
Patterns:
- OpenAI keys:    /sk-[A-Za-z0-9]{32,}/
- Anthropic keys: /sk-ant-[A-Za-z0-9]{32,}/
- AWS keys:       /AKIA[0-9A-Z]{16}/
- GitHub tokens:  /ghp_[0-9a-zA-Z]{36}/
- Generic:        /(api[_-]?key|token|secret|password)[\s:=]+['\"]?[A-Za-z0-9_\-]{8,}['\"]?/
- JWT tokens:     /eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/
```

### 2. Personally Identifiable Information (PII)
```
Patterns:
- Email:       /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
- Phone UK:    /(\+44|0)7\d{9}/
- NI number:   /[A-Z]{2}\d{6}[A-Z]/
- Postcode:    /[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/i
- Credit card: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/
- IP addresses: /\b(?:\d{1,3}\.){3}\d{1,3}\b/
```

### 3. Internal infrastructure
```
Patterns:
- Internal IPs:      /(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})/
- Internal hosts:    /\.internal|\.local|\.corp/
- Connection strings: /(mysql|postgres|mongodb|redis):\/\/[^@]+@[^/]+/
```

## Detection modes

### Block mode (default for critical patterns)
- Pattern detected → message blocked entirely
- User receives: "Message blocked by DLP: sensitive data detected ({pattern_type})."
- Event logged to audit with full context

### Redact mode (for medium patterns)
- Pattern detected → data replaced with [REDACTED]
- Message continues with redacted content
- Event logged: "Pattern {type} redacted in message to {channel}"

### Log-only mode (for low patterns)
- Pattern detected → logged, message continues unchanged
- Used for: monitoring, establishing baselines
- Useful for: new patterns being tested before enforcement

## Per-tenant configuration
```typescript
interface EgressConfig {
  enabled: boolean; // Default: true
  mode: 'block' | 'redact' | 'log'; // Default per pattern type
  
  patterns: {
    api_keys: 'block',           // Always block API keys
    passwords: 'block',          // Always block passwords  
    email: 'redact',             // Redact email addresses
    phone: 'redact',             // Redact phone numbers
    credit_card: 'block',        // Block credit card numbers
    internal_ip: 'redact',       // Redact internal IPs
    connection_string: 'block',  // Block DB connection strings
  };
  
  custom_patterns: string[]; // Tenant-specific regex patterns
  whitelist: string[]; // Patterns to never flag
}
```

## Redaction format
```
Before: "My email is laud@example.com and my phone is 07123456789"
After:  "My email is [EMAIL_REDACTED] and my phone is [PHONE_REDACTED]"
```

## Scanned channels
Egress filtering applies to ALL outbound channels:
- Chat responses (web, Telegram, Discord, Slack, SMS)
- Tool results passed to user
- File deliveries (scan file contents before sending)
- Email notifications
- Push notifications

## Verification
```bash
# 1. Test API key leak
curl -X POST /api/chat/send -d '{"message": "my key is sk-abc123def456ghi789jkl012mno345pqr678stu"}'
# Expected: blocked; "Message blocked by DLP: API key detected"

# 2. Test email redaction
curl -X POST /api/chat/send -d '{"message": "contact me at laud@example.com"}'
# Expected: redacted; "contact me at [EMAIL_REDACTED]"

# 3. Test internal IP
curl -X POST /api/chat/send -d '{"message": "server is at 10.0.0.15"}'
# Expected: redacted or blocked

# 4. Check audit log
curl /api/admin/scout/audit/search?event_type=egress
# Expected: all egress events with pattern type and action taken

# 5. Test whitelist
# Add "laud@example.com" to whitelist
# Send: "contact me at laud@example.com"
# Expected: NOT redacted (whitelisted)
```
