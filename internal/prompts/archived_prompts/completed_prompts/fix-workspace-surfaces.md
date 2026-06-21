# Fix Workspace Surfaces

## Context

You are working in the Carina mono-repo, focused on the core web app at `core.carinaai.uk/`.

The current workspace shell already exists. These pages are mounted by `packages/web/src/web-server.ts` and themed by `packages/web/src/workspace-chrome.ts`:

- `/`
- `/notes`
- `/calendar`
- `/documents`
- `/images`
- `/email`
- `/memory`
- `/kanban`
- `/webhooks`
- `/packs`
- `/workspace`

The chat shell is responsive and PWA-oriented, but the workspace surfaces still have discoverability and completeness gaps.

Current gaps to close:

1. Chat does not make workspace discovery obvious enough on desktop or mobile.
2. There is no dedicated `/compare` workspace page.
3. There is no dedicated `/research` workspace page.
4. The calendar surface is still notes-centric and does not expose a real CalDAV sync path.
5. The workspace navigation and settings surfaces need to stay quiet on mobile so the session-first chat UI remains clean.

Do not add marketing copy. Do not add decorative clutter. Keep the UI operational, compact, and easy to scan.

No em dashes, no emojis, plain ASCII only.

---

## Task 1: Make workspace discovery obvious from chat

File:
- `packages/web/assets/web/index.html`

Goal:
- Add a clear but restrained `Workspace` entry point in the chat header.
- Do not bury workspace access inside the sidebar or a secondary settings flow.
- Keep the chat page clean on mobile. The new entry point should not fight the MIT footer or the sign-in surface.

Requirements:
- Add a `Workspace` link/button near the existing top controls.
- Keep it visually consistent with the current icon button and pill styles.
- Preserve the session-first chat layout.
- Do not place workspace navigation inside the message composer or the conversation body.

Acceptance:
- A user can reach the workspace from the main chat page in one click.
- The desktop and mobile shells still feel uncluttered.

---

## Task 2: Add a `/compare` workspace page

Current state:
- `/compare` is recognized by routing and command handling, but there is no dedicated workspace page for it.

Files:
- `packages/web/src/workspace-chrome.ts`
- `packages/web/src/web-server.ts`
- `packages/web/assets/web/compare.html`

Goal:
- Add a real compare surface for side-by-side model responses.

Behavior:
- The page should accept one prompt and run it against multiple configured providers.
- Each provider response should render in its own column or card.
- Results should stream if the backend supports streaming.
- Add a blind mode toggle so provider names can be hidden until the run finishes.
- Keep the layout responsive and readable on narrow screens.

Implementation notes:
- Add `compare` to `WorkspacePageId`.
- Add a nav item for `/compare` in `WORKSPACE_NAV_ITEMS`.
- Register a `/compare` route in `web-server.ts` using the same workspace decoration pattern as the other pages.
- Reuse the existing `/api/chat/stream` path if possible.
- Do not introduce new auth rules.

Acceptance:
- `/compare` loads as a first-class workspace page.
- The page can run the same prompt across multiple providers and render the outputs side by side.

---

## Task 3: Add a `/research` workspace page

Current state:
- `/research` is recognized by routing and command handling, but there is no dedicated workspace page.

Files:
- `packages/web/src/workspace-chrome.ts`
- `packages/web/src/web-server.ts`
- `packages/web/assets/web/research.html`

Goal:
- Add a real research surface for deep, cited, multi-step work.

Behavior:
- The page should accept a research question.
- The page should stream the research output.
- Render the result as markdown.
- Persist recent research sessions locally so the user can reopen them.
- Keep the page focused on research output, not general chat.

Implementation notes:
- Add `research` to `WorkspacePageId`.
- Add a nav item for `/research` in `WORKSPACE_NAV_ITEMS`.
- Register a `/research` route in `web-server.ts` using the same workspace decoration pattern.
- Reuse the existing `/api/chat/stream` or the current research command path.
- Keep external dependencies minimal. If you use a markdown renderer, prefer an existing local asset or a standard repo pattern.

Acceptance:
- `/research` loads as a first-class workspace page.
- The page produces a usable research result, not just a transcript dump.

---

## Task 4: Make calendar useful beyond notes reminders

Current state:
- `/calendar` renders reminder-style events derived from notes.
- That is useful, but it is not a syncable calendar surface yet.

Files:
- `packages/web/assets/web/calendar.html`
- `packages/web/assets/web/calendar.js`
- `packages/web/src/web-server.ts`
- `src/gateway/` or a nearby API module

Goal:
- Keep the notes-derived calendar view.
- Add a real calendar sync path so external calendars can be connected later.

Requirements:
- Add a calendar API that can return events in a queryable format, such as `GET /api/calendar/events?start=...&end=...`.
- Keep notes-derived reminders working.
- Add a CalDAV integration path behind env vars, not hardcoded hostnames.
- Use a strict opt-in model for any sync credentials.
- If full CalDAV sync is not ready, expose a clear placeholder route and data contract rather than pretending it exists.

Suggested env vars:
- `CALDAV_URL`
- `CALDAV_USERNAME`
- `CALDAV_PASSWORD`
- `CALDAV_PRINCIPAL_URL` if needed

Acceptance:
- The calendar page still works for reminders.
- There is a concrete backend sync contract for CalDAV instead of a dead-end UI.

---

## Task 5: Keep workspace chrome mobile friendly

Files:
- `packages/web/src/workspace-chrome.ts`
- `packages/web/assets/web/index.html`
- `packages/web/assets/web/workspace.html`

Goal:
- Preserve the clean mobile PWA shell.
- Keep workspace navigation visible, but not noisy.

Requirements:
- Do not overload the sidebar with extra high-traffic controls.
- Avoid showing settings, personalization, or operational links inline if they only belong in a modal or secondary menu.
- Make sure the workspace sidebar still fits narrow screens without overlapping or clipping important labels.
- Keep the chat page and the workspace pages visually distinct.

Acceptance:
- The mobile shell remains usable and compact.
- Workspace navigation does not overwhelm the primary chat flow.

---

## Task 6: Tests

Add or update tests for the behavior you touch.

Minimum coverage:
- workspace chrome injection and nav item order
- `/compare` route registration and page decoration
- `/research` route registration and page decoration
- calendar event data shape
- CalDAV config or placeholder behavior
- chat header workspace entry point if you modify it

Prefer the repo’s current Vitest patterns and keep tests close to the changed modules.

Acceptance:
- The new pages and navigation are covered by tests.
- The calendar API contract is covered by tests.

---

## Implementation order

1. Add the chat workspace entry point.
2. Add `compare` and `research` to the workspace chrome.
3. Add the two workspace pages and routes.
4. Add the calendar API contract and sync hooks.
5. Tighten the mobile shell.
6. Add tests.

---

## Definition of done

The workspace surfaces are done when:

- A user can discover the workspace from chat immediately.
- `/compare` exists and is useful.
- `/research` exists and is useful.
- The calendar has a real sync path, not just notes-based reminders.
- The chat and workspace shells stay clean on mobile.
- Tests prove the new surfaces work.
