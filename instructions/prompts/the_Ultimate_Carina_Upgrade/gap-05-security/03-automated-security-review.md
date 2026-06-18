# Security 03; Automated Security Code Review Bot

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Source:** OpenClaw ClawSweeper (`openclaw/clawsweeper`)
**Effort:** 3 weeks

## SPECIFICATION

Automated security review bot that runs on every PR, commit, and skill submission. ClawSweeper automatically reviews every code change for security issues, policy violations, and attack surface changes.

### Review Pipeline

```
PR Opened/Updated
  → Static Analysis (SAST)
    → eslint security rules, CodeQL, custom rules
  → Dependency Scan
    → npm audit, OSS review
  → Attack Surface Analysis
    → New tools? New endpoints? New permissions?
  → Policy Compliance
    → Does this change follow security policy?
  → Scout Integration
    → Scout trust score check
  → Verdict
    → APPROVED / NEEDS REVIEW / BLOCKED
```

### Implementation

```typescript
// security/automated-review/review-bot.ts

interface SecurityReview {
  prNumber: number;
  sha: string;
  files: ChangedFile[];
  findings: SecurityFinding[];
  verdict: 'approved' | 'needs_review' | 'blocked';
  score: number; // 0-100 security score
}

interface SecurityFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  file: string;
  line: number;
  description: string;
  recommendation: string;
  autoFixable: boolean;
}

const REVIEW_RULES = [
  // Critical; BLOCK merge
  { pattern: /eval\(|Function\(|exec\(.*user_input/, severity: 'critical', message: 'Code injection risk' },
  { pattern: /password\s*[=:]\s*['"][^'"]+['"]/, severity: 'critical', message: 'Hardcoded credential' },
  { pattern: /http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, severity: 'critical', message: 'Hardcoded internal IP' },
  
  // High; NEEDS REVIEW
  { pattern: /new\s+Tool\(/, severity: 'high', message: 'New tool registration; review attack surface' },
  { pattern: /child_process\.exec\(/, severity: 'high', message: 'Shell execution; prefer spawn with arg array' },
  
  // Medium; WARN
  { pattern: /\.innerHTML\s*=/, severity: 'medium', message: 'innerHTML; prefer textContent or safe DOM APIs' },
  { pattern: /console\.log\(.*(?:token|key|secret|password)/, severity: 'medium', message: 'Possible credential leak in logs' },
];

// GitHub integration
// Posts review comments on PR, blocks merge for critical findings
// Auto-fixes medium findings when possible
// Weekly digest email to security team
```

### Scout Integration

```typescript
// Every PR gets a Scout trust check
const scoutReview = await scoutClient.reviewPR({
  prNumber,
  files: changedFiles,
  author: prAuthor,
  // Scout checks:
  // - Is this author trusted? (trust score)
  // - Do these file changes match known attack patterns?
  // - Has this author had recent security incidents?
});
```

---

## REFERENCE

OpenClaw: `openclaw/clawsweeper/`