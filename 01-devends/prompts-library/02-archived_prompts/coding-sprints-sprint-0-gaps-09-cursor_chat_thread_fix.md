Use this one too. It focuses on the thread/state bug separately.

  In core.carinaai.uk, fix the chat thread state so Carina never appears to forget the conversation or reintroduce itself mid-thread.

  Problem:
  - Sometimes Carina resumes as if it is a new chat.
  - It may repeat its identity or restart tone unexpectedly.
  - The current turn/session handling seems to let streamed replies land in the wrong place or lose context.

  Goals:
  1. Make every assistant turn belong to one stable session/thread.
  2. Ensure a streamed reply can only finalize into the turn that started it.
  3. Prevent any response from being attached to the wrong chat after switching threads or starting a new message.
  4. Preserve conversation context correctly so Carina does not act like the thread reset.
  5. Keep the fix focused on turn/session lifecycle code and the chat UI state.

  Tasks:
  - Inspect the session/turn IDs used by the chat frontend and backend stream handling.
  - Verify that each outgoing user message creates a unique turn id.
  - Bind every streaming token and final message to that turn id.
  - Reject or ignore late chunks from older turns.
  - Cancel the active stream when the user switches chats or sends a new message.
  - Make sure partial assistant content is stored only against the originating session.
  - Make sure the assistant prompt does not force a fresh self-introduction on every turn unless the thread is actually new.
  - Add regression tests for:
    - switching chats while a response is streaming
    - sending a second message before the first reply finishes
    - returning to a prior thread and continuing it correctly

  Acceptance criteria:
  - Carina never writes a response into the wrong chat.
  - Carina never restarts the conversation tone unless the session is new.
  - Switching threads cannot corrupt the active stream.
  - A completed reply always lands in the correct session.
  - Tests fail before the fix and pass after.

  Run the relevant unit/integration tests and verify the behavior in the browser after the change.

  The first prompt gives you the visual “thinking” state. This one fixes the underlying thread integrity.

