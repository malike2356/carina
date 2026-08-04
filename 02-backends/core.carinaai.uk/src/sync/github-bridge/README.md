# GitHub agent-sync bridge

Neutral durable-memory bridge used by Carina and Aiva.

- Canonical repo: `malike2356/agent-sync` (override via settings)
- Scope: each connection is isolated per workspace or per user; nothing is global
- Auth: fine-grained PAT or GitHub App token via `AGENT_SYNC_GITHUB_TOKEN` / Settings UI (never committed)
- Pull on an interval; push on approved durable writes (or optional push interval)
- Retrieval: local keyword index + best-effort `rag_chunks` upsert
- Policy: deny secrets / ephemeral chat; write only to approved folders from `sync/manifest.json`

API: `/api/agent-sync/*`
Tool: `github-agent-sync`
UI: `/settings/agent-sync`
