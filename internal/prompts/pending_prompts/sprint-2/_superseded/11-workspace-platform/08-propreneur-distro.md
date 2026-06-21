# Prompt 08: Propreneur Distro


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Propreneur (`propreneur.uk` on Contabo VPS `aman`) is the estate agent / property
professional platform. It already has a Cal.com integration and an API. Building a
Propreneur distro creates a live customer-facing example of Carina as a product.

The Propreneur distro uses the existing `property-uk` skill pack in `brain/property-uk/`
and adds Propreneur-specific modules for lead management and appointment booking.

## What to Build

### 1. Propreneur distro definition

Create `packages/distros/propreneur/carina.distro.json`:
```json
{
  "id": "propreneur",
  "name": "Propreneur Property Assistant",
  "version": "0.1.0",
  "description": "Carina configured for UK property professionals",
  "branding": {
    "agentName": "Your Property Assistant",
    "primaryColor": "#0ea5e9",
    "tagline": "Powered by Carina"
  },
  "systemPrompt": { "file": "prompts/system.md" },
  "skills": {
    "required": ["property-uk", "property-valuation", "rightmove-search"],
    "optional": ["web-search", "calendar", "email-draft"]
  },
  "tools": {
    "allowed": ["web-search", "calendar", "email-draft", "read-file"],
    "blocked": ["nmap", "nikto", "nuclei", "sqlmap", "shell", "forensics"]
  },
  "channels": {
    "enabled": ["web", "whatsapp", "email"],
    "disabled": ["sms"]
  },
  "memory": { "namespace": "propreneur", "isolate": true },
  "ui": {
    "theme": "light",
    "primaryColor": "#0ea5e9"
  }
}
```

### 2. Propreneur system prompt

Create `packages/distros/propreneur/prompts/system.md`:
```markdown
You are a property assistant for UK estate agents and property professionals on Propreneur.

You help with:
- Property valuations and market analysis
- Searching Rightmove and Zoopla for similar properties
- Drafting property descriptions and marketing copy
- Answering UK property law questions (stamp duty, conveyancing timeline)
- Booking viewings via Cal.com (available tools: calendar)
- Drafting client communications

IMPORTANT: You are an assistant, not a regulated financial or legal adviser. For regulated
advice, always refer clients to a qualified solicitor or financial adviser.

When asked about property values: use property-valuation skill with Rightmove comparables.
When asked to book a viewing: use the calendar tool (Cal.com integration).
```

### 3. Cal.com booking skill

Create `packages/distros/propreneur/skills/book-viewing.ts`:
```typescript
export const bookViewingSkill = defineSkill({
  name: 'book-viewing',
  description: 'Book a property viewing via Cal.com',
  tools: ['calendar'],
  parameters: {
    propertyAddress: { type: 'string', required: true },
    clientName: { type: 'string', required: true },
    clientEmail: { type: 'string', required: true },
    preferredDate: { type: 'string', required: false },
  },
  async execute({ propertyAddress, clientName, clientEmail, preferredDate }) {
    // Use Cal.com API via calendar tool
    // Cal.com API base: process.env.CAL_API_URL (documented in PROPRENEUR_AND_CAL_RUNBOOK.md)
    return `Booking request for ${propertyAddress} submitted for ${clientName}. Confirmation sent to ${clientEmail}.`;
  },
});
```

### 4. Lead capture workflow

Create `packages/distros/propreneur/workflows/lead-capture.ts`:
```typescript
// Triggered when a potential buyer or seller asks about a property
export async function leadCaptureWorkflow(ctx: WorkflowContext): Promise<void> {
  const { message, session } = ctx;

  // Detect lead intent
  const isLead = /interested|viewing|value|valuation|sell|buy/i.test(message);
  if (!isLead) return;

  // Ask for contact details if not already in memory
  const contactMemory = await ctx.memory.get('contact-details');
  if (!contactMemory) {
    await ctx.agent.say('I can help with that. Could I take your name and email so we can follow up?');
    const details = await ctx.agent.collect(['name', 'email']);
    await ctx.memory.set('contact-details', details);
    await sendLeadToPropreneur(details);
  }
}
```

### 5. Propreneur API integration

The Propreneur API (`propreneur.uk/api/`) is documented in `propreneur/api/docs/README.md`.
Add a `propreneur-api` tool in the distro:
```typescript
export const propreneurApiTool = defineTool({
  name: 'propreneur-api',
  description: 'Query the Propreneur property database and lead management system',
  parameters: {
    endpoint: { type: 'string' },
    method: { type: 'string', enum: ['GET', 'POST'] },
    body: { type: 'object', required: false },
  },
  execute: async ({ endpoint, method, body }) => {
    const resp = await fetch(`${process.env.PROPRENEUR_API_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.PROPRENEUR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return resp.json();
  },
});
```

## Verification Checklist

- [ ] `CARINA_DISTRO=propreneur carina cli` starts with "Propreneur Property Assistant"
- [ ] Asking "what's 15 Acacia Avenue worth?" triggers property-valuation skill
- [ ] Asking "book a viewing for this property" triggers book-viewing skill via Cal.com
- [ ] Lead capture workflow runs when message contains "interested"
- [ ] Security tools (nmap, nikto) are blocked

## Files to Create or Modify

- CREATE `packages/distros/propreneur/carina.distro.json`
- CREATE `packages/distros/propreneur/prompts/system.md`
- CREATE `packages/distros/propreneur/skills/book-viewing.ts`
- CREATE `packages/distros/propreneur/workflows/lead-capture.ts`
- CREATE `packages/distros/propreneur/tools/propreneur-api.ts`
- CREATE `packages/distros/propreneur/README.md`
