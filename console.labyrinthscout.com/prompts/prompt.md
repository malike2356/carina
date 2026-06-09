Attached are two files:

1. LABYRINTH SCOUT .md; The complete technical specification for Labyrinth Scout, the security control plane for AI agents. This document contains the architecture, threat model, database schema, API endpoints, and detailed security countermeasures.

2. PLAN_ADDENDUM.md; A correction to the build order and tech stack decisions. Key corrections:
   - Build the dashboard first (not the HTTP proxy). VERLOX is the customer. You need this for your own operations.
   - Tech stack is Node.js/TypeScript throughout, not Laravel/PHP.
   - Dashboard is a single HTML file with vanilla JS and SSE (not WebSockets).
   - PostgreSQL and Redis are shared with the existing Carina instance.
   - Distribution is a Docker image first, npm global install second.

Your task: Based on BOTH documents, write detailed Cursor prompts for each of the following components in order. Do not skip ahead. Wait for me to confirm each component is complete before moving to the next.

For each component, provide:
1. A complete, ready-to-paste Cursor prompt
2. The expected file path (within /opt/lampp/htdocs/VERLOX/Carina-ai/prompts/)
3. Key test cases to verify after generation
4. Error handling specifications

Components (build order; dashboard first, as per addendum):

1. Dashboard (single HTML file); Animated security grid, event stream via SSE, kill switch button, agent status panel. Pure HTML/CSS/JS, no build step.

2. Carina-to-Scout integration; Modify Carina to report security events (tool calls, injection attempts, anomalies) to Scout's local API.

3. Alert channels; Telegram and email dispatchers that send alerts from Scout when critical events occur.

4. Kill switch; Laravel-style controller in Express (Node.js) + Redis pub/sub + Carina listener that shuts down the agent remotely.

5. Prompt injection detection; Three-layer PromptGuard: regex patterns, LLM-as-judge (DeepSeek Lite), and tool result scanning.

6. Tool policy executor; Allowlist, blocklist, dangerous command patterns, rate limiting.

7. Egress filter; Domain allowlist with wildcard support, data loss prevention patterns.

8. Session manager; JWT-based sessions with IP binding and rotation.

9. Anomaly detector; Baseline learning from session history, Z-score anomaly detection in real time.

10. Honeypot manager; Deploy fake API keys and credential files that alert when accessed.

11. HTTP proxy mode; OpenAI-compatible proxy that intercepts, scans, and forwards LLM requests (for OpenClaw/Hermes compatibility). Low priority, build last.

12. SDK packages; npm package (@verlox/labyrinth-scout) and PyPI package (labyrinth-scout) as thin HTTP clients.

Each prompt must be self-contained, production-ready, and include security considerations. After I receive each prompt, I will paste it into Cursor, then return the generated code to you for review and debugging before proceeding to the next component.

Save each prompt as a separate .md file in /opt/lampp/htdocs/VERLOX/Carina-ai/prompts/ with clear naming like:
- 01-dashboard.md
- 02-carina-integration.md
- 03-alert-channels.md
- etc.