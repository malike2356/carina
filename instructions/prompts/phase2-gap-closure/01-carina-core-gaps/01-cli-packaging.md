# Phase 2.1 — Carina CLI Packaging (npm install)

## Goal
Build the standalone Carina CLI that installs via `npm install -g carina`. The CLI wraps the agent engine and provides `carina chat`, `carina serve`, and `carina config` commands. This is the foundation for every "runs locally" and "npm install" claim on carinaai.uk.

## Files to create
```
packages/cli/
  package.json              — npm package manifest (name: "carina", bin: { carina: "./dist/index.js" })
  src/
    index.ts                — CLI entry point, command routing
    commands/
      chat.ts               — carina chat (start interactive agent session)
      serve.ts              — carina serve (start local API server)
      config.ts             — carina config (set/get config values)
      setup.ts              — carina setup (guided first-time setup wizard)
      version.ts            — carina --version
    config/
      loader.ts             — Reads carina.yaml from ~/.carina/config.yaml
      defaults.ts           — Default configuration values
      env.ts                — .env file loader for API keys
    local/
      db.ts                 — SQLite database (same schema as Postgres, different driver)
      session.ts            — Local session manager (file-based, no Redis needed)
    output/
      formatter.ts          — Terminal output formatting (colors, tables, progress)
      streaming.ts          — Streaming response display
  templates/
    config.default.yaml     — Default config shipped with the package
    .env.example            — Example environment file
  README.md                 — Installation and usage docs
```

## What each command does

### carina chat
```
$ carina chat
Carina > Hello! How can I help you today?

You: What's the weather in Portsmouth?
Carina: [calls weather tool] Currently 18°C, partly cloudy.

You: /exit
Goodbye!
```
- Starts interactive REPL session
- Each message goes through the agentic loop
- Tool calls displayed inline
- Streaming responses (tokens appear as they arrive)
- Commands: /exit, /help, /clear, /model (switch provider)
- Reads config from ~/.carina/config.yaml

### carina serve
```
$ carina serve
Carina API running on http://localhost:3000
Chat: http://localhost:3000/chat
API:  http://localhost:3000/api
```
- Starts local HTTP server with same API as the cloud version
- Chat endpoint: POST /api/chat/send
- WebSocket for streaming: ws://localhost:3000/ws
- Config endpoint: GET /api/config
- Serves a minimal web UI at http://localhost:3000/

### carina config
```
$ carina config set providers.deepseek.api_key "***"
$ carina config get providers
$ carina config list
```
- Read/write ~/.carina/config.yaml
- Nested key support (providers.deepseek.model)
- Validates config against schema
- Provides defaults for missing values

### carina setup
```
$ carina setup
Welcome to Carina! Let's get you set up.

Which AI provider? [deepseek/anthropic/openai/openrouter]:
API key: ***
Default model: [deepseek-v4-pro]:

Setup complete! Run 'carina chat' to start.
```
- Guided first-time configuration
- Creates ~/.carina/config.yaml
- Creates ~/.carina/.env (API keys stored here, not in config)
- Tests API connection before saving

## Package structure
```json
{
  "name": "carina",
  "version": "1.0.0",
  "description": "Autonomous AI agent — runs locally, remembers everything, gets smarter every session",
  "bin": {
    "carina": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@carina/engine": "1.0.0"
  }
}
```

## Implementation notes
- The CLI is a thin wrapper over `@carina/engine`
- It imports the engine, injects local config, and starts the agent
- SQLite for single-user mode (same schema as Postgres for cloud)
- No npm registry publish yet — local `npm link` for development
- README must include: install, setup, chat, serve, config commands with examples

## Verification
```bash
npm install -g carina       # Must install without errors
carina --version            # Must print version
carina setup                # Must create config interactively
carina chat                 # Must start interactive agent session
carina serve                # Must start local server
curl http://localhost:3000/api/health  # Must return 200
```

## Dependencies
- @carina/engine (the agent engine from engine/)
- TypeScript compiler
- Node.js 18+
