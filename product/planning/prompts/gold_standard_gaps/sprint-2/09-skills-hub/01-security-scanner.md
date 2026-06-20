# Prompt 01: Skills Security Scanner

## Context

The Skills Hub accepts skill submissions. Before a skill is approved for the marketplace,
it must pass a security scan: prompt injection patterns, dangerous shell commands, external
network calls to non-whitelisted domains, and excessive permission requests.

## What to Build

### 1. Static analysis scanner

Create `src/skills/scanner/static-analyzer.ts`:
```typescript
export type ScanFinding = {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  line?: number;
  message: string;
};

export async function scanSkill(skillContent: string): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];
  const lines = skillContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Prompt injection patterns in string literals
    if (/ignore.*previous.*instruction/i.test(line) ||
        /system.*prompt/i.test(line)) {
      findings.push({ severity: 'critical', type: 'prompt-injection', line: i + 1, message: 'Potential prompt injection in skill content' });
    }

    // Dangerous shell patterns
    if (/exec|spawn|child_process/i.test(line) && !/\/\/.*/i.test(line)) {
      findings.push({ severity: 'high', type: 'shell-execution', line: i + 1, message: 'Shell execution detected - requires manual review' });
    }

    // External network calls
    const urlMatch = line.match(/https?:\/\/([a-z0-9.-]+)/i);
    if (urlMatch && !isWhitelistedDomain(urlMatch[1])) {
      findings.push({ severity: 'medium', type: 'external-network', line: i + 1, message: `Call to non-whitelisted domain: ${urlMatch[1]}` });
    }

    // File system access outside allowed paths
    if (/require\(['"]fs['"]\)|readFileSync|writeFileSync/i.test(line)) {
      findings.push({ severity: 'medium', type: 'fs-access', line: i + 1, message: 'Direct filesystem access - should use Carina file tools instead' });
    }

    // Eval or dynamic code execution
    if (/\beval\s*\(|new Function\s*\(/i.test(line)) {
      findings.push({ severity: 'critical', type: 'code-injection', line: i + 1, message: 'Dynamic code execution (eval/Function) is not permitted' });
    }
  }

  return findings;
}

const WHITELISTED_DOMAINS = new Set(['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com']);
function isWhitelistedDomain(domain: string): boolean {
  return WHITELISTED_DOMAINS.has(domain);
}
```

### 2. Scan API

In `src/api/skills.ts`, add scan endpoint:
```
POST /api/skills/scan        - scan skill content before submission
POST /api/ops/skills/scan    - ops-gated re-scan of submitted skill
```

Response:
```json
{
  "passed": false,
  "score": 72,
  "findings": [
    { "severity": "high", "type": "shell-execution", "line": 14, "message": "..." }
  ],
  "summary": "1 high finding. Manual review required."
}
```

### 3. Auto-reject policy

Skills with any `critical` finding are automatically rejected with a message.
Skills with `high` findings are flagged for manual review.
Skills with only `medium` and `low` findings are auto-approved with the findings noted.
Skills with zero findings are auto-approved immediately.

### 4. Hub integration

When a skill is submitted via `POST /api/skills/submit`, automatically run the scanner:
```typescript
const findings = await scanSkill(skill.content);
const criticals = findings.filter(f => f.severity === 'critical');
if (criticals.length > 0) {
  return { approved: false, reason: 'auto-rejected', findings };
}
```

### 5. Skill sandbox (stretch goal)

If time permits, run submitted skills in a Node.js `vm` context with restricted globals:
```typescript
const { Script, createContext } = await import('vm');
const sandbox = createContext({
  console: { log: () => {} },  // no real console
  fetch: undefined,             // no network
  require: undefined,           // no require
});
new Script(skillContent).runInContext(sandbox, { timeout: 1000 });
```

This catches syntax errors and runtime errors before the skill reaches the hub.

## Verification Checklist

- [ ] Skill with `eval(` returns critical finding
- [ ] Skill with `exec(` returns high finding
- [ ] Skill calling `https://evil.com` returns medium finding for non-whitelisted domain
- [ ] Clean skill passes scan with score 100 and zero findings
- [ ] Submit a skill with critical finding via API - auto-rejected with `findings` in response

## Files to Create or Modify

- CREATE `src/skills/scanner/static-analyzer.ts`
- MODIFY `src/api/skills.ts` - add /api/skills/scan route and auto-scan on submit
- CREATE `src/skills/scanner/sandbox.ts` (stretch goal)
