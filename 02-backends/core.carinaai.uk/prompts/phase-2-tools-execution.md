# Phase 2 - Tools + Execution

**Status: COMPLETE**

All deliverables built by Cursor. Do not rebuild.

## What Was Built

- `src/tools/registry.ts` - `ToolRegistry` with `register`, `get`, `list`, `toProviderFormat` (Anthropic and OpenAI schemas)
- `src/tools/index.ts` - registers all tools; conditionally registers property-data and land-registry when API keys set
- `src/tools/path-utils.ts` - `expandPath` (`~/`), `isSafePath` (blocks `..` traversal and system paths), `isBlockedSystemWrite`
- `src/tools/web-search.ts` - Brave Search API, validates key, returns `[{title, url, description}]`
- `src/tools/file.ts` - `file-read` (100KB limit, truncation notice) and `file-write` (confirms on overwrite, blocks system paths)
- `src/tools/shell.ts` - `shell-exec`, `dangerous: true`, logs to `data/logs/shell.log`, routes through Docker sandbox
- `src/tools/http.ts` - `http-request`, HTTPS-only, SSRF prevention (blocks localhost and RFC1918 ranges), 15s timeout, 50KB body limit
- `src/tools/email.ts` - `email-send` (Resend) and `email-list` (queries `inbound_emails` table)
- `src/tools/code.ts` - `code-exec`, auto-detects JS/Python, routes to Docker; falls back to Node `vm` if Docker unavailable; `requiresConfirmation` on `import`/`require`/`process`
- `src/tools/sandbox.ts` - `runInSandbox` and `runCodeInSandbox` via `docker run --rm --network=none --memory= --cpus=0.5 --read-only --tmpfs /tmp`; `initSandbox()` checks Docker at boot; `runJsVmFallback` for no-Docker environments
- `src/agents/tool-runner.ts` - `executeToolCall()`: checks `dangerous`, `requiresConfirmation`, `needsConfirmation()` dynamic check, calls `confirmTool` if present, catches and returns errors as `{error: string}`
- `src/agents/carina.ts` - `CarinaAgent` with full ReAct agentic loop: builds context (session history + semantic search + RAG + skill lookup), streams tokens, collects tool calls, executes via `tool-runner`, loops until no tool calls remain
- `src/brain/messages.ts` - `toAnthropicMessages`, `toOpenAIMessages`, `anthropicTools`, `openaiTools` conversion helpers
- Updated `src/brain/llm.ts` - all three providers accept `tools?: Tool[]`; streaming accumulates tool calls from deltas; `LLMRouter.chatCheap()` prefers DeepSeek for meta-calls
- `src/skills/packs/property-uk/tools/property-data.ts` - `property-data-lookup` tool (PropertyData API)
- `src/skills/packs/property-uk/tools/land-registry.ts` - `land-registry-lookup` tool stub
