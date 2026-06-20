# Prompt 02: TUI Approval Flow for Risky Tool Calls

## Context

Some tool calls require human approval before execution: deleting files, sending emails,
executing exploits, making external API writes. Currently Carina executes all tool calls
without user confirmation in CLI/TUI mode (the web UI has an approval modal).

The TUI needs an inline approval prompt that blocks execution until the user confirms or
cancels. This prompt should be non-intrusive: it appears inside the chat panel and the user
approves with a single keypress.

## What to Build

### 1. Tool approval gate

In `src/tools/approval-gate.ts`:
```typescript
export type ApprovalRequest = {
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: 'medium' | 'high' | 'critical';
  description: string;
};

export type ApprovalResponse = 'approve' | 'deny' | 'modify';

// Tools that always require approval
export const APPROVAL_REQUIRED: Set<string> = new Set([
  'delete-file',
  'run-command',   // shell execution
  'send-email',
  'metasploit',
  'sqlmap',
  'deploy',
  'database-write',
]);

export function requiresApproval(toolName: string): boolean {
  return APPROVAL_REQUIRED.has(toolName);
}
```

### 2. Approval prompt component for TUI

In `src/tui/ApprovalPrompt.tsx` using Ink:
```tsx
export function ApprovalPrompt({
  request,
  onResponse,
}: {
  request: ApprovalRequest;
  onResponse: (r: ApprovalResponse) => void;
}) {
  useInput((input) => {
    if (input === 'y' || input === 'Y') onResponse('approve');
    if (input === 'n' || input === 'N') onResponse('deny');
  });

  const riskColor = {
    medium: 'yellow',
    high: 'red',
    critical: 'redBright',
  }[request.riskLevel];

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={riskColor} padding={1}>
      <Text bold color={riskColor}>
        {request.riskLevel.toUpperCase()} RISK: {request.toolName}
      </Text>
      <Text>{request.description}</Text>
      <Text dimColor>Args: {JSON.stringify(request.args, null, 2)}</Text>
      <Text>
        <Text color="green">[Y]</Text> Approve   <Text color="red">[N]</Text> Deny
      </Text>
    </Box>
  );
}
```

### 3. Agent integration

In `src/agents/CarinaAgent.ts`, before invoking a tool that requires approval:
```typescript
if (requiresApproval(toolName) && this.interface === 'tui') {
  const approved = await this.requestApproval({ toolName, args, riskLevel, description });
  if (!approved) {
    return { error: 'Tool execution cancelled by operator.' };
  }
}
```

The `requestApproval` method blocks on a Promise that resolves when the TUI approval
component calls `onResponse`.

### 4. Approval in non-interactive mode

When running in non-interactive mode (piped stdin, CI, `--yes` flag):
- `--yes` flag: auto-approve all tool calls (logged to Scout with `auto-approved: true`)
- `--no-interactive` flag: deny all approval-required tool calls with clear error
- CI mode (no TTY): deny all, emit error with tool name and risk level

### 5. Scout integration

Every approval decision is emitted to Scout:
```typescript
scout.emit({
  type: 'tool-approval',
  toolName,
  riskLevel,
  decision: 'approve' | 'deny',
  interface: 'tui' | 'cli' | 'auto',
  timestamp: new Date(),
});
```

## Verification Checklist

- [ ] Run `carina ask "delete /tmp/test.txt"` in TUI - approval prompt appears before deletion
- [ ] Press N - tool is denied, Carina reports cancellation in chat
- [ ] Press Y - tool executes, result shown in chat
- [ ] `carina --yes ask "delete /tmp/test.txt"` auto-approves and logs to Scout
- [ ] Scout shows `tool-approval` events with decision field

## Files to Create or Modify

- CREATE `src/tools/approval-gate.ts`
- CREATE `src/tui/ApprovalPrompt.tsx`
- MODIFY `src/agents/CarinaAgent.ts` - add pre-execution approval check
- MODIFY `bin/carina.ts` - add `--yes` and `--no-interactive` flags
- MODIFY `src/security/scout-client.ts` - add tool-approval event type
