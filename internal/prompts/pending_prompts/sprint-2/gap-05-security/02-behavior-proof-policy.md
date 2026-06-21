# Security 02; Real Behavior Proof Policy

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Source:** OpenClaw (`scripts/github/real-behavior-proof-policy.mjs`, `.github/workflows/real-behavior-proof.yml`)
**Status:** Missing (Carina has tool-execution-context.ts but no verification pipeline)
**Effort:** 2 weeks

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## SPECIFICATION

### What This Is

The agent claims it did something. Did it actually do it? OpenClaw's Real Behavior Proof policy verifies every agent claim against actual tool output. It asks: "Show me the evidence." If the agent says it wrote a file, verify the file exists and has the right content. If it says it sent an email, verify the SMTP log. No trust. Only proof.

### Implementation

```typescript
// security/behavior-proof.ts

/**
 * Behavior proof; verify that the agent actually did what it claimed.
 * 
 * Pattern: OpenClaw real-behavior-proof-policy.mjs
 * Principle: "Trust but verify" → "Distrust and prove"
 */

interface AgentClaim {
  type: 'file_write' | 'file_read' | 'command_exec' | 'api_call' | 
        'message_sent' | 'resource_created' | 'resource_deleted';
  description: string; // What the agent says it did
  evidence: EvidenceItem[]; // Tool output that proves the claim
  timestamp: number;
}

interface EvidenceItem {
  type: 'file_exists' | 'file_content_hash' | 'command_exit_code' | 
        'api_response' | 'message_delivery' | 'resource_state';
  value: unknown;
  verified: boolean;
}

interface ProofResult {
  claim: AgentClaim;
  passed: boolean;
  failures: string[];
  verifiedAt: number;
}

/**
 * Verify that a file was written with expected content.
 */
async function verifyFileWrite(claim: AgentClaim): Promise<ProofResult> {
  const failures: string[] = [];
  
  // Extract file path from claim
  const path = extractFilePath(claim.description);
  if (!path) {
    return { claim, passed: false, failures: ['Could not extract file path from claim'], verifiedAt: Date.now() };
  }
  
  // Verify file exists
  const exists = await fileExists(path);
  if (!exists) {
    failures.push(`File does not exist: ${path}`);
  }
  
  // If content hash provided, verify it
  const expectedHash = extractContentHash(claim);
  if (expectedHash) {
    const actualHash = await sha256File(path);
    if (actualHash !== expectedHash) {
      failures.push(`Content hash mismatch. Expected: ${expectedHash}, Actual: ${actualHash}`);
    }
  }
  
  return {
    claim,
    passed: failures.length === 0,
    failures,
    verifiedAt: Date.now(),
  };
}

/**
 * Verify a command was executed successfully.
 */
async function verifyCommandExec(claim: AgentClaim): Promise<ProofResult> {
  const failures: string[] = [];
  
  // Check exit code from tool output
  const exitCode = extractExitCode(claim.evidence);
  if (exitCode !== 0) {
    failures.push(`Command exited with code ${exitCode}`);
  }
  
  // If output assertion, verify it
  const assertion = extractOutputAssertion(claim);
  if (assertion) {
    const actualOutput = extractToolOutput(claim.evidence);
    if (!assertion.matches(actualOutput)) {
      failures.push(`Output assertion failed: ${assertion.describe()}`);
    }
  }
  
  return {
    claim,
    passed: failures.length === 0,
    failures,
    verifiedAt: Date.now(),
  };
}

/**
 * Verify a message was sent (email, Slack, Telegram, etc).
 */
async function verifyMessageSent(claim: AgentClaim): Promise<ProofResult> {
  const failures: string[] = [];
  
  const delivery = extractDeliveryConfirmation(claim.evidence);
  if (!delivery) {
    failures.push('No delivery confirmation in tool output');
  }
  
  if (delivery && delivery.status !== 'delivered') {
    failures.push(`Message status: ${delivery.status}, expected: delivered`);
  }
  
  return {
    claim,
    passed: failures.length === 0,
    failures,
    verifiedAt: Date.now(),
  };
}

/**
 * Main proof pipeline.
 */
export async function verifyBehavior(claims: AgentClaim[]): Promise<ProofResult[]> {
  const results: ProofResult[] = [];
  
  for (const claim of claims) {
    let result: ProofResult;
    
    switch (claim.type) {
      case 'file_write':
        result = await verifyFileWrite(claim);
        break;
      case 'command_exec':
        result = await verifyCommandExec(claim);
        break;
      case 'message_sent':
        result = await verifyMessageSent(claim);
        break;
      default:
        result = {
          claim,
          passed: false,
          failures: [`Unknown claim type: ${claim.type}`],
          verifiedAt: Date.now(),
        };
    }
    
    results.push(result);
    
    // Log failures
    if (!result.passed) {
      logger.warn('Behavior proof FAILED', {
        claimType: claim.type,
        description: claim.description,
        failures: result.failures,
      });
    }
  }
  
  return results;
}
```

### CI/CD Integration

```yaml
# .github/workflows/behavior-proof.yml
name: Real Behavior Proof

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      - name: Run behavior proof checks
        run: |
          # Extract claims from PR description and code changes
          # Verify each claim against actual tool output
          node scripts/behavior-proof-check.mjs
      
      - name: Report results
        if: failure()
        run: |
          echo "Behavior proof FAILED. The agent claimed to do something but evidence is missing."
          echo "Check the PR description or commit messages for unsupported claims."
```

### Agent Prompt Integration

Inject into system prompt:

```
# Behavior Proof Policy
When you claim to have done something (written a file, sent a message,
executed a command, created a resource), your claim MUST be backed by
actual tool output. Never claim success without the tool result.

For file writes: include the file path and SHA-256 hash.
For commands: include the exit code and relevant output.
For messages: include the delivery confirmation.
For API calls: include the response status and key data.

If a tool fails: report the failure honestly. Do not fabricate success.
```

### Existing Carina Integration

```typescript
// Extend security/tool-execution-context.ts
// Add claim tracking
export interface ToolExecutionContext {
  // ... existing fields
  claims: AgentClaim[]; // NEW: track what the agent claims
}

// After every tool execution:
function recordClaim(context: ToolExecutionContext, toolName: string, result: ToolResult) {
  const claim = extractClaimFromResult(toolName, result);
  if (claim) {
    context.claims.push(claim);
  }
}
```

---

## REFERENCE FILES

```
OpenClaw:
  openclaw/scripts/github/real-behavior-proof-policy.mjs
  openclaw/scripts/github/real-behavior-proof-check.mjs
  openclaw/.github/workflows/real-behavior-proof.yml

Carina (extend):
  security/tool-execution-context.ts; add claim tracking
  agents/tool-runner.ts; record claims after execution
  agents/system-prompt.ts; inject proof policy
```