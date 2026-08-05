
  In core.carinaai.uk, fix the chat UI so Carina visibly shows that it is thinking/processing while a response is streaming.

  Problem:
  - Right now, when Carina is busy there is no visible processing state.
  - The UI looks frozen until the reply appears.
  - Sometimes the assistant seems to "reintroduce" itself as if the thread reset.
  - The experience feels dead compared with ChatGPT/Claude/DeepSeek.

  Goals:
  1. Show a clear in-progress state as soon as a user message is submitted.
  2. Keep that state visible until the final assistant message is complete.
  3. Make the state feel like active processing, not just a static loading label.
  4. Prevent thread resets or assistant self-reintroduction caused by streaming/session state bugs.
  5. Keep the change narrow to the web UI and turn lifecycle code unless a backend event is required.

  Tasks:
  - Inspect the chat frontend and streaming response handling.
  - Add a visible assistant placeholder/bubble while the stream is active.
  - Use a compact animated indicator, such as dots, pulsing cursor, or a subtle typing bar.
  - The indicator must be tied to the current turn id or session id, so it cannot leak into another thread.
  - If the stream stalls, keep the busy state visible instead of leaving the page looking idle.
  - When the response completes, replace the placeholder with the final assistant message cleanly.
  - If a new message is sent before the previous stream finishes, cancel or isolate the earlier stream so it cannot reappear in the wrong chat.
  - Make sure the assistant never reintroduces itself at the start of a normal reply unless the system prompt explicitly requires it.
  - Keep the visuals minimal and consistent with the existing UI.

  Acceptance criteria:
  - After sending a message, the user immediately sees that Carina is working.
  - There is a live visual cue during the entire wait period.
  - The assistant thread never looks abandoned or reset mid-turn.
  - The final response lands in the correct thread.
  - No stale in-progress indicator remains after completion or cancellation.

  After the change, run the relevant tests for chat/session streaming and verify in the browser that the busy state appears while waiting for a response.

