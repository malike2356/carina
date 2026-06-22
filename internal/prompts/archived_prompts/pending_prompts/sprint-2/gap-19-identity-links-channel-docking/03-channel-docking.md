**Status: COMPLETED 2026-06-21**

**What was built:**
- `gateway/channel-docking.ts` with dock, undock, and dockable channel listing
- `/dock list|to|back|status` commands; router preserves docked reply delivery target
- Docking status in system prompt via `formatLinkedIdentitiesBlock()`

# Gap 19 - Prompt 03: Channel Docking -- Move Reply Route Between Channels

**Gap:** 19 Identity Links & Channel Docking
**Prompt number:** 03 of 03
**Name:** Channel docking -- move session reply route to a different channel
**Primary agent:** Claude Code
**Estimated hours:** 2 h
**Depends on:** 02-shared-sessions.md

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `gateway/router.ts` -- session routing, reply delivery
2. `gateway/channels/adapters/` -- per-channel delivery
3. This gap's prompts 01 + 02

---

## Goal

Channel docking lets the user move an active session's reply stream to a
different linked channel. Example: start a long-running code task on Telegram,
then dock it to WebChat for a richer display.

### Step 1: Docking Command

```
/dock list          Show available channels for this session
/dock to <channel>  Move reply stream to specified channel
/dock back          Return reply stream to original channel
/dock status        Show current reply channel
```

### Step 2: Docking Implementation

Create `gateway/channel-docking.ts`:

```typescript
export class ChannelDocking {
  /**
   * Dock a session's reply route to a different channel.
   * The new channel must be linked to the same canonical user.
   */
  async dock(
    sessionId: string,
    canonicalUserId: string,
    targetChannel: string,
    identityResolver: IdentityResolver,
  ): Promise<DockResult> {
    // Verify the user has an identity on the target channel
    const targetIdentity = await identityResolver.resolveToChannel(
      canonicalUserId, targetChannel
    );
    if (!targetIdentity) {
      return {
        success: false,
        error: `No linked identity on ${targetChannel}. Use /link first.`,
      };
    }

    // Get session
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found.' };
    }

    // Announce the switch on the old channel
    const oldChannel = session.metadata.replyChannel;
    await this.sendDockingAnnouncement(session, oldChannel, targetChannel);

    // Update reply route
    session.metadata.replyChannel = targetChannel;
    session.metadata.dockedFrom = oldChannel;
    session.metadata.dockedAt = Date.now();

    // Announce on the new channel
    await this.sendDockArrival(session, targetChannel, oldChannel);

    return {
      success: true,
      dockedTo: targetChannel,
      dockedFrom: oldChannel,
    };
  }

  /**
   * Return reply stream to the original channel.
   */
  async undock(sessionId: string): Promise<DockResult> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session?.metadata?.dockedFrom) {
      return { success: false, error: 'Session is not docked.' };
    }

    const originalChannel = session.metadata.dockedFrom;
    session.metadata.replyChannel = originalChannel;
    delete session.metadata.dockedFrom;
    delete session.metadata.dockedAt;

    return {
      success: true,
      dockedTo: originalChannel,
      dockedFrom: session.metadata.replyChannel,
    };
  }
}
```

### Step 3: Agent System Prompt Update

When a session is docked, the system prompt reflects it:

```
## Channel Docking
This session was started on: Telegram
Currently replying on: WebChat
Use /dock back to return replies to Telegram.
```

### Step 4: Restrictions

- Can only dock to channels linked to the same canonical user
- During a streaming response, docking is queued (applied after current chunk)
- Docking does NOT transfer message history -- only the reply route changes
- Undock returns to the original channel; the session stays shared

---

## Existing Carina code to integrate with

- `gateway/router.ts` -- session reply routing
- `agents/command-handler.ts` -- `/dock` command
- `agents/system-prompt.ts` -- docking status in prompt
- `gateway/identity-resolver.ts` -- verify channel identity (from prompt 01)
