# Prompt 07: ABBIS Distro - Proof of Concept

## Context

ABBIS is the most mature in-house application (abbis3.2/abbis3.3 at
`/opt/lampp/htdocs/abbis3.2/` and `/opt/lampp/htdocs/abbis3.3/`). Building the ABBIS
distro proves the Workspace Platform works end-to-end: a real application with real
skill packs, real module data, and real users.

This is a read-heavy proof-of-concept. The goal is to produce a working distro that
can be loaded with `carina distro install abbis`, not to replace the ABBIS application.

## What to Build

### 1. ABBIS distro definition

Create `packages/distros/abbis/carina.distro.json`:
```json
{
  "id": "abbis",
  "name": "ABBIS Practice Manager",
  "version": "0.1.0",
  "description": "Carina configured for ABBIS legal practice management",
  "branding": {
    "agentName": "ABBIS Assistant",
    "primaryColor": "#1e40af",
    "logoBgColor": "#dbeafe"
  },
  "systemPrompt": { "file": "prompts/system.md" },
  "skills": {
    "required": ["abbis-billing", "abbis-cases", "document-reader"],
    "optional": ["web-search", "calendar"]
  },
  "tools": {
    "allowed": ["read-file", "write-file", "web-search", "calendar", "email"],
    "blocked": ["nmap", "nikto", "nuclei", "sqlmap", "metasploit"]
  },
  "channels": {
    "enabled": ["web", "email"],
    "disabled": ["sms", "whatsapp"]
  },
  "memory": { "namespace": "abbis", "isolate": true },
  "ui": {
    "theme": "light",
    "panels": ["chat", "memory", "file-browser"],
    "hidePanels": ["terminal", "scout"]
  }
}
```

### 2. ABBIS system prompt

Create `packages/distros/abbis/prompts/system.md`:
```markdown
You are the ABBIS Practice Assistant, an AI assistant for the ABBIS legal practice
management system.

You help legal professionals with:
- Case lookup and status updates
- Billing queries and invoice generation
- Document drafting and review
- Deadline tracking and calendar management
- Client communication drafts

Context for this practice:
{{practiceArea}} | {{practiceLocation}}

Always maintain professional tone. Never give legal advice directly - frame responses
as administrative support and information.

When looking up cases or billing: use the abbis-cases and abbis-billing skills.
When drafting documents: use document-reader to review templates, then draft.
```

### 3. ABBIS skill pack (billing skill)

Create `packages/distros/abbis/skills/abbis-billing.ts`:
```typescript
import { defineSkill } from '@verlox/carina-sdk';

export const abbisBillingSkill = defineSkill({
  name: 'abbis-billing',
  description: 'Query ABBIS billing records, generate invoice summaries',
  tools: ['read-file', 'web-search'],
  prompts: {
    main: `You are reviewing ABBIS billing data. When asked about invoices or billing:
1. Use read-file to load relevant billing CSV or report
2. Summarize the key figures clearly
3. Flag any overdue items
4. Offer to draft a payment reminder if items are overdue`,
  },
  parameters: {
    clientId: { type: 'string', description: 'Client reference number', required: false },
    month: { type: 'string', description: 'Month to query (YYYY-MM)', required: false },
  },
});
```

### 4. Integration test

After installing the distro, verify:
```bash
# Start Carina with ABBIS distro
CARINA_DISTRO=abbis carina cli

# Test that:
# 1. Agent greets as "ABBIS Assistant"
# 2. nmap tool is blocked
# 3. abbis-billing skill is active
# 4. Asking "show me overdue invoices" triggers abbis-billing skill
```

### 5. Distro README

Create `packages/distros/abbis/README.md`:
- Installation instructions
- What the ABBIS distro does vs generic Carina
- Skill reference table
- Example queries that work well
- How to update the system prompt for a specific practice

## Verification Checklist

- [ ] `carina distro validate packages/distros/abbis/carina.distro.json` passes
- [ ] `CARINA_DISTRO=abbis carina cli` starts with "ABBIS Practice Manager" branding
- [ ] Asking Carina "run nmap on localhost" returns a blocked-tool error
- [ ] Asking "summarize billing for client 001" activates the abbis-billing skill
- [ ] Memory is isolated to `abbis` namespace (no cross-contamination with general sessions)

## Files to Create or Modify

- CREATE `packages/distros/abbis/carina.distro.json`
- CREATE `packages/distros/abbis/prompts/system.md`
- CREATE `packages/distros/abbis/skills/abbis-billing.ts`
- CREATE `packages/distros/abbis/skills/abbis-cases.ts`
- CREATE `packages/distros/abbis/README.md`
- MODIFY `pnpm-workspace.yaml` - add `packages/distros/*` to workspaces if not already
