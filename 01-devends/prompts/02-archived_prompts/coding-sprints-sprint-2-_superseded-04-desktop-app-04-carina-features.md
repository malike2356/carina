# Prompt 04: Carina Desktop-Specific Features


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

The desktop app has native capabilities that enhance Carina beyond what the browser can do:
local terminal bridge (run commands on the user's machine, not the server), local file access
(drag files directly from the OS into Carina), and offline mode (use cached responses when
the Carina server is unreachable).

## What to Build

### 1. Local terminal bridge

In the browser, the PTY terminal (Prompt 02 of web-ui category) connects to the Carina
server's shell. In the desktop app, a local terminal connects to the user's local shell.

Create `apps/desktop/src-tauri/src/local_terminal.rs`:
```rust
use std::process::{Command, Stdio};
use tauri::ipc::Channel;

#[tauri::command]
pub async fn run_local_command(
  command: String,
  channel: Channel<String>,
) -> Result<i32, String> {
  let output = Command::new("sh")
    .arg("-c")
    .arg(&command)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| e.to_string())?;

  // Stream stdout/stderr to the web UI via channel
  // ...
  Ok(0)
}
```

In the web UI, add a toggle on the terminal panel: "Local" vs "Server". In Local mode,
commands run on the user's machine via `invoke('run_local_command', ...)`.

### 2. Local file access

In the web workspace, the file browser accesses server-side files. In desktop mode,
add a "Local Files" tab to the file browser that accesses the user's local filesystem
via Tauri's fs plugin:

```typescript
import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';

async function openLocalFolder() {
  const selected = await open({ directory: true, multiple: false });
  if (selected) {
    const entries = await readDir(selected as string);
    // render in file browser
  }
}
```

Drag-and-drop from the OS file manager into the Carina window uploads the file:
```typescript
window.addEventListener('tauri://drag-drop', async (event: any) => {
  for (const path of event.payload.paths) {
    const content = await readTextFile(path);
    // send to chat or upload to server
  }
});
```

### 3. Offline mode

When the desktop app cannot reach the Carina server (network down, server not running),
it should:
1. Show an offline banner: "Carina server unreachable - working from cache"
2. Allow browsing cached sessions and memories (read-only)
3. Queue outgoing messages for when connectivity resumes
4. Show last-known Scout status from cache

Create `apps/cloud/src/lib/offline.ts`:
```typescript
export class OfflineManager {
  private queue: QueuedMessage[] = [];

  async detectOffline(): Promise<boolean> {
    try {
      await fetch('/health', { signal: AbortSignal.timeout(2000) });
      return false;
    } catch {
      return true;
    }
  }

  queueMessage(sessionId: string, content: string): void {
    this.queue.push({ sessionId, content, timestamp: new Date() });
    localStorage.setItem('offline-queue', JSON.stringify(this.queue));
  }

  async flushQueue(): Promise<void> {
    // When connectivity resumes, send all queued messages
    for (const msg of this.queue) {
      await sendMessage(msg.sessionId, msg.content);
    }
    this.queue = [];
  }
}
```

### 4. Carina server auto-start

When the desktop app opens and the Carina server is not running locally, offer to start it:
```
Carina server is not running.
Would you like to start it? [Start] [Connect to Remote]
```

"Start" runs `node /path/to/dist/src/server.js` via `tauri-plugin-shell`:
```typescript
import { Command } from '@tauri-apps/plugin-shell';

const server = Command.create('node', [serverPath]);
await server.spawn();
```

The path to the server is stored in desktop settings (defaults to `~/.carina/server/`).

## Verification Checklist

- [ ] "Local" terminal tab runs `ls` on the user's machine (not the server)
- [ ] Drag a .txt file from Finder/Explorer into Carina - file content appears in chat
- [ ] Disconnect from network - offline banner appears, cached sessions are browsable
- [ ] Reconnect - queued message sends automatically
- [ ] "Start server" button from within the desktop app starts the Carina Node.js process

## Files to Create or Modify

- CREATE `apps/desktop/src-tauri/src/local_terminal.rs`
- MODIFY `apps/desktop/src-tauri/src/main.rs` - register local terminal command
- MODIFY `apps/cloud/src/components/Terminal.tsx` - add Local/Server toggle
- MODIFY `apps/cloud/src/components/FileBrowser.tsx` - add Local Files tab (desktop only)
- CREATE `apps/cloud/src/lib/offline.ts`
- MODIFY `apps/cloud/src/App.tsx` - integrate OfflineManager
