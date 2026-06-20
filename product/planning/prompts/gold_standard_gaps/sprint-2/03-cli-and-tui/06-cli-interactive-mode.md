# Prompt 06: CLI Interactive Mode

## Context

`carina ask "<question>"` runs a single query and exits. `carina` with no args opens the TUI
(from Prompt 01). There is a third mode needed: an interactive REPL that stays in the
terminal without the Ink TUI (for minimal environments like SSH without color support, or
Docker containers where Ink TUI doesn't render cleanly).

Interactive REPL mode: `carina --interactive` or `carina -i`.

## What to Build

### 1. REPL mode

Create `src/cli/repl.ts`:
```typescript
import { createInterface } from 'readline';
import { CarinaAgent } from '../agents/CarinaAgent.js';

export async function launchRepl(sessionId?: string): Promise<void> {
  const agent = new CarinaAgent({ interface: 'cli', sessionId });
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'carina> ',
    historySize: 200,
    terminal: process.stdout.isTTY,
  });

  console.log('Carina interactive mode. Type "exit" or press Ctrl+D to quit.');
  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();
    if (!trimmed) { rl.prompt(); return; }
    if (trimmed === 'exit' || trimmed === 'quit') { rl.close(); return; }

    rl.pause();
    try {
      await agent.ask(trimmed, {
        onToken: (token) => process.stdout.write(token),
        onTool: (tool, args) => console.log(`\n[tool: ${tool}] ${JSON.stringify(args)}`),
        onDone: () => { process.stdout.write('\n'); rl.resume(); rl.prompt(); },
      });
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      rl.resume();
      rl.prompt();
    }
  });

  rl.on('close', () => {
    console.log('\nGoodbye.');
    process.exit(0);
  });
}
```

### 2. REPL slash commands

Inside the REPL, the user can type slash commands for quick actions without leaving:

| Command | Action |
|---------|--------|
| `/session new` | Start a new session |
| `/session list` | List sessions (inline, compact) |
| `/session <id>` | Switch to session |
| `/memory search <query>` | Search memory inline |
| `/clear` | Clear REPL output (cls) |
| `/model <name>` | Switch active model for this session |
| `/tools` | List available tools |
| `/help` | Show slash commands |
| `/exit` | Exit REPL |

### 3. Piped input mode

When stdin is not a TTY (piped from a file or another command), REPL mode processes
each line as a separate query and exits:

```bash
# Run batch of questions from a file
cat questions.txt | carina --interactive
```

Output format in piped mode is JSON per line (JSONL):
```json
{"question": "what is my Scout score", "answer": "87", "session_id": "abc-123"}
{"question": "list open CVEs", "answer": "...", "session_id": "abc-123"}
```

### 4. REPL history

The REPL saves readline history to `~/.carina/repl_history`. Max 1,000 lines. Entries
are persisted across sessions. Up/Down arrow navigates history within a session (built
into readline). Ctrl+R enables reverse search.

### 5. Entry point

In `bin/carina.ts`:
```typescript
program
  .option('-i, --interactive', 'Start interactive REPL mode')
  .hook('preAction', async (thisCommand) => {
    if (thisCommand.opts().interactive) {
      const { launchRepl } = await import('../src/cli/repl.js');
      await launchRepl();
      process.exit(0);
    }
  });
```

## Verification Checklist

- [ ] `carina -i` opens REPL with `carina>` prompt
- [ ] Type a question, get streaming response, return to prompt
- [ ] `/session new` starts a new session (ID shown in prompt: `carina[new]>`)
- [ ] `echo "list my sessions" | carina -i` outputs JSONL and exits
- [ ] Up arrow recalls previous queries
- [ ] `carina -i` in a Docker container with no color support works without Ink errors

## Files to Create or Modify

- CREATE `src/cli/repl.ts`
- MODIFY `bin/carina.ts` - add `--interactive` flag and hook
