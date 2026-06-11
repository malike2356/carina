# Email

Two Resend-backed tools: `email-send` and `email-list`.

## Requirements

```
RESEND_API_KEY=...
```

Default From header: `Carina <hello@carinaai.uk>` (configure in code for self-hosted branding).

## email-send

Sends a plain or HTML email to one or more recipients.

### Example

> "Email the viewing summary to investor@example.com with subject Portsmouth BRR update."

## email-list

Lists recent messages from the configured Resend account (inbound/outbound visibility depends on Resend setup).

### Example

> "List the last 5 emails we received."

## Security

- No confirmation required by default.
- Scout reports sends as tool calls.
- Do not ask Carina to exfiltrate secrets via email; egress and prompt guard apply to surrounding context.

## Returns

Send: Resend message id or error. List: array of message metadata.
