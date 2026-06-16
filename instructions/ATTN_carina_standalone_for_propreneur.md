the advice on Question 3:

  ---
  3. Carina Standalone to Propreneur: Best Direction
  
  Two modes to consider: capability exposure vs. full workspace access. They are different problems.

  Mode A: Expose Carina's AI capability to Propreneur users (recommended first step)

  Propreneur's existing Carina assistant module (the propreneur-assistant app you're in now) already has some AI
  integration path. The cleanest extension is ACP:

  - Carina runs on the VPS at http://localhost:3333 (or its own subdomain ai.propreneur.uk)
  - Propreneur's PHP backend makes a server-side HTTP call to POST /acp/prompt with { prompt, sessionId, stream: 
  true }
  - Auth: Authorization: Bearer <CARINA_OPS_TOKEN> (set in Carina's .env)
  - Streaming: Carina replies with SSE chunks; Propreneur's PHP buffers and re-streams to the frontend, or collects
  and returns JSON
  - Session: use the Propreneur user's ID as sessionId so Carina remembers across sessions
  3. Carina Standalone to Propreneur: Best Direction

  Two modes to consider: capability exposure vs. full workspace access. They are different problems.

  Mode A: Expose Carina's AI capability to Propreneur users (recommended first step)

  Propreneur's existing Carina assistant module (the propreneur-assistant app you're in now) already has some AI integration path. The cleanest extension is ACP:

  - Carina runs on the VPS at http://localhost:3333 (or its own subdomain ai.propreneur.uk)
  - Propreneur's PHP backend makes a server-side HTTP call to POST /acp/prompt with { prompt, sessionId, stream: true }
  - Auth: Authorization: Bearer <CARINA_OPS_TOKEN> (set in Carina's .env)
  - Streaming: Carina replies with SSE chunks; Propreneur's PHP buffers and re-streams to the frontend, or collects and returns JSON
  - Session: use the Propreneur user's ID as sessionId so Carina remembers across sessions

  This gives Propreneur users access to Carina's full tool set (web search, browser, kanban, memory, etc.) without any UI changes to Carina itself.

  What to build: A PHP service class in Propreneur that wraps the ACP HTTP call. About 60 lines. Propreneur's assistant feature calls this class instead of (or before) calling Anthropic directly.

  Mode B: Give Propreneur users access to Carina's full workspace (calendar, documents, notes, email)

  JWT SSO bridge - the only viable pattern for cross-app workspace access:

  1. Propreneur generates a short-lived signed JWT: { sub: propreneurUserId, email, org, exp }
  2. A "Carina workspace" button in Propreneur redirects to https://workspace.carinaai.uk/auth/sso?token=<jwt>
  3. Carina validates the JWT (shared secret in .env), creates a hosted session scoped to that org, and drops the user into /workspace
  4. User gets full Carina workspace: notes, calendar, documents, images, email triage - all scoped to their Propreneur org

  What to build:
  - In Carina: a new GET /auth/sso route in src/api/hosted-auth.ts (or new file) that validates the JWT and issues a Carina session cookie
  - In Propreneur: a PHP JWT generator (~20 lines) and a "Carina workspace" link in the workspace UI

  Why not iframe: iframes have cookie/session isolation problems (Safari blocks third-party cookies), and the UX is worse than a clean redirect. JWT SSO is the industry standard for this.

  Mode C: Carina as a named channel for Propreneur (lightest touch)

  Register a propreneur channel adapter in Carina that accepts POST /webhooks/propreneur with { userId, message, sessionId } and replies with { reply, sessionId }. Propreneur calls this webhook, Carina responds. No Carina UI changes
  needed. Users chat with Carina from inside Propreneur's own chat UI.

  Ranked recommendation:

  ┌───────────┬─────────────────────────┬────────────┬───────────────────────────────────────┐
  │ Priority  │          Mode           │ Build time │            What users get             │
  ├───────────┼─────────────────────────┼────────────┼───────────────────────────────────────┤
  │ Do first  │ Mode A: ACP             │ 1-2 days   │ Carina's brain in Propreneur's chat   │
  ├───────────┼─────────────────────────┼────────────┼───────────────────────────────────────┤
  │ Do second │ Mode C: Webhook channel │ 0.5 days   │ Structured Propreneur chat routing    │
  ├───────────┼─────────────────────────┼────────────┼───────────────────────────────────────┤
  │ Do after  │ Mode B: JWT SSO         │ 3-4 days   │ Full Carina workspace from Propreneur │
  └───────────┴─────────────────────────┴────────────┴───────────────────────────────────────┘

  Start with A (ACP) because it has the highest feature payoff for the least code. The ACP endpoint is already built and tested. Mode B is the right long-term answer if you want Propreneur users to have notes, calendar, documents - but it
  requires a proper session/auth bridge.

