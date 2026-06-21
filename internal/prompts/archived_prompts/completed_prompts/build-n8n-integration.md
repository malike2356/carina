# Build n8n Integration for Carina

**Working directory:** /opt/lampp/htdocs/verlox/carina/core.carinaai.uk
**Goal:** Carina and n8n talk to each other. Two-way integration. Both sides built.

---

## What This Does

n8n (https://n8n.io) is a visual workflow automation platform -- open-source Zapier. 50K+ GitHub stars. Users build automation flows in a drag-and-drop editor.

This integration lets:
1. **n8n call Carina** -- drop a Carina node into any n8n workflow. Send a prompt. Get an agent response back. n8n handles the plumbing (connecting to email, Slack, databases, 400+ apps). Carina handles the intelligence.
2. **Carina call n8n** -- trigger n8n workflows from Carina. "Carina, run the monthly portfolio report" fires an n8n workflow that pulls data, processes it, and emails the result.

---

## Part 1: Carina n8n Tool (Carina calls n8n)

### New file: `src/tools/n8n.ts`

A tool that lets Carina trigger n8n workflows and check their execution status.

```typescript
// Tool: n8n
// Actions: trigger, status, list
//
// trigger: Fire an n8n workflow by ID. Optional payload.
// status: Check execution status by execution ID.
// list: List available workflows (requires n8n API key).
```

**Parameters:**
- `action` (required): 'trigger' | 'status' | 'list'
- `workflowId` (trigger/list): n8n workflow ID or name
- `payload` (trigger, optional): JSON payload to send to the workflow
- `executionId` (status): n8n execution ID to check
- `baseUrl` (optional): n8n instance URL. Defaults to `N8N_BASE_URL` env var.
- `apiKey` (optional): n8n API key. Defaults to `N8N_API_KEY` env var.

**For trigger:** POSTs to `{baseUrl}/api/v1/workflows/{id}/activate` with payload. Returns execution ID and status.

**For status:** GETs `{baseUrl}/api/v1/executions/{id}`. Returns status (running/succeeded/failed), duration, and result data.

**For list:** GETs `{baseUrl}/api/v1/workflows`. Returns workflow names, IDs, and active status.

**Also register a webhook tool action:** n8n can fire Carina's existing webhook endpoint. Add an `n8n` action to the existing `webhook` tool that registers an n8n-compatible webhook endpoint and returns the URL for the n8n workflow to call.

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `N8N_BASE_URL` | For trigger/list | n8n instance URL, e.g. `https://n8n.example.com` |
| `N8N_API_KEY` | For trigger/list | n8n API key (generated in n8n Settings > API) |

---

## Part 2: n8n Custom Node (n8n calls Carina)

### New directory: `integrations/n8n-carina-node/`

A community node package for n8n that anyone can install. This is NOT built into Carina's core -- it's a separate npm package published to npm as `n8n-nodes-carina`.

**Package structure:**
```
integrations/n8n-carina-node/
├── package.json                     # name: n8n-nodes-carina, keywords: n8n-community-node
├── nodes/Carina/
│   ├── Carina.node.ts               # The node implementation
│   ├── Carina.node.json             # Node metadata, display name, description
│   └── carina.svg                   # Node icon
├── credentials/
│   └── CarinaApi.credentials.ts      # API key credential type
├── README.md
├── LICENSE                           # MIT
└── tsconfig.json
```

**The node must:**

1. **Accept a prompt** -- the user types what they want Carina to do. Can be static text or an n8n expression referencing previous node output.

2. **Accept a system prompt (optional)** -- context about the task. Can reference n8n workflow variables.

3. **Accept a model override (optional)** -- which LLM provider/model to use. Dropdown populated from Carina's provider list.

4. **Accept a domain pack override (optional)** -- which domain pack to load. E.g. property-uk for property tasks.

5. **Accept a session ID (optional)** -- persistent session key for continuity across n8n workflow runs.

6. **Call Carina's API** -- POST to `{baseUrl}/api/v1/agent/task` with the prompt, system prompt, model, pack, and session ID.

7. **Return the response** -- Carina's text response as the node output. Available to downstream n8n nodes.

8. **Handle streaming** -- Carina streams responses. The node should collect the full stream before passing output to the next node. Optionally show partial output in the n8n UI during execution.

9. **Handle errors gracefully** -- if Carina is unreachable, the node fails with a clear error message, not a crash.

**Credential type:**
- `baseUrl`: Carina API URL (default: `http://localhost:3333`)
- `apiKey`: Carina API key (from `CARINA_OPS_TOKEN` or `CARINA_WEB_PASSWORD`)
- `timeout`: Request timeout in seconds (default: 120)

**The node must work:**
- With self-hosted Carina (local network or VPS)
- With Carina Cloud (carinaai.uk hosted)
- With or without Scout enabled

**README must include:**
- `npm install n8n-nodes-carina` install instructions
- How to configure the credential (baseUrl + apiKey)
- Sample workflow: "When email arrives → Carina analyzes it → Slack notification"
- Sample workflow: "Daily cron → Carina generates portfolio report → Google Sheets append"
- Link to Carina docs and n8n community node docs

---

## Part 3: Documentation

### New file: `docs/integrations/n8n.md`

Documentation page covering:
1. What n8n is and why integrate with Carina
2. Installing the n8n node: `npm install n8n-nodes-carina`
3. Configuring the credential
4. Example workflows with screenshots
5. Using Carina's n8n tool in chat: "carina, trigger the portfolio report workflow"
6. Setting up n8n webhooks to receive Carina task outputs
7. Environment variables reference

### Update: `docs/capabilities.md`

Add n8n to the integrations list. "Carina integrates with n8n for visual workflow automation."

---

## Files To Inspect First (for context)

- `src/tools/webhook.ts` -- existing webhook tool (extend with n8n action)
- `src/tools/http.ts` -- existing HTTP tool (n8n trigger uses REST)
- `src/api/` -- existing API endpoints (n8n node calls Carina's API)
- `src/config/index.ts` -- where env vars are registered
- Existing tool patterns in `src/tools/` for structure consistency

---

## What NOT To Do

- Do NOT build n8n itself. Only the integration.
- Do NOT add n8n as a Carina dependency. The n8n node is a separate package.
- Do NOT require n8n to use Carina. The integration is opt-in.
- Do NOT expose Carina's internal API without authentication. The n8n node uses the same auth as other API clients.
- No emojis. No em-dashes. Plain ASCII.
- TypeScript strict mode.

---

## Acceptance Criteria

1. `carina trigger n8n workflow portfolio-report` works from chat and CLI
2. n8n node installed via `npm install n8n-nodes-carina` appears in n8n editor
3. Sample workflow "Carina analyzes email → Slack notification" runs end-to-end
4. Carina can list available n8n workflows and check execution status
5. Errors surface clearly: if n8n is down, Carina says so. If Carina is down, n8n node says so.
6. Documentation page published at docs/integrations/n8n.md
7. Tests: n8n tool trigger, status, list, error cases. n8n node credential, API call, error cases.
