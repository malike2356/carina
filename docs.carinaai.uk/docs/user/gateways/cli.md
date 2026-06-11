# CLI Gateway

The CLI is the default interactive gateway when stdin is a TTY.

## Starting

```bash
pnpm cli          # from source (tsx)
carina            # after npm install -g carina-agent
carina --cli-only # disables web and Telegram for terminal-only use
```

## Commands

Type these at the `You:` prompt:

| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/provider` | List available providers |
| `/provider deepseek` | Switch to DeepSeek |
| `/provider anthropic` | Switch to Claude |
| `/provider openai` | Switch to OpenAI |
| `/clear` | Clear in-session memory (DB episodic memory remains) |
| `/recall` | Show last 10 session turns |
| `/recall 20` | Show last N turns |
| `/skills` | List saved skill documents with usage counts |
| `/memories` | List episodic memories (requires memory store) |
| `/memories delete <id>` | Delete a specific memory by UUID |
| `exit` | Quit the process |

`/memories` and `/provider` also work on Telegram and Web. `/recall` and `/skills` are CLI-only.

## Streaming

Carina streams token-by-token to stdout. Tool use appears inline as status text during the response (for example `[using web-search...]`).

## Tool confirmation

Destructive or dangerous tools prompt before execution:

```
Run this tool? (y/N):
```

Only `y` runs the tool; Enter or any other key cancels.

## Session

The CLI uses a stable session id per machine (`cli` + `local`). Episodic memory and Scout events attach to this session id when configured.

## Without memory

If Postgres is unreachable, the CLI still runs but logs `Memory: unavailable (chat only)` and `/recall` returns no turns.
