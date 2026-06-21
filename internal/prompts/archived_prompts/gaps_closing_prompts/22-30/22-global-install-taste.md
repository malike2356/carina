# Global Install and First Run Taste

You are working in the Carina core and distribution codebase. Build the first-use experience so a user can install Carina globally and reach value in one command.

Product goal:
- `npm install -g carina-agent`
- one command to start
- the agent introduces itself
- it asks for the user name and what they are building
- within five minutes, the user is in a real conversation
- no YAML setup debt
- no manual API key juggling on first run

Why this matters:
- The first-run taste is the wedge.
- If the installation and onboarding are not frictionless, users never reach the learning loop or the trust story.

Scope:
- packaging and publish flow
- global binary entry point
- first-run onboarding
- local config bootstrap
- provider bootstrap
- fallback paths when no config exists
- documentation only where it supports the shipped flow

Requirements:
- Make the package installable and runnable as a global CLI.
- Ensure the first-run path can bootstrap a usable session without editing config files manually.
- Ask only the minimum required questions.
- Persist the answers into the correct local config or profile store.
- Keep the defaults safe and explicit.
- Make the onboarding flow work in both a clean install and a partially configured machine.
- Add tests for install-time behavior, first-run prompts, and bootstrap persistence.

Implementation notes:
- Prefer a single command path over multiple setup screens.
- Reuse existing profile, provider, and onboarding primitives.
- Do not add a large setup wizard if a short guided flow is enough.
- Make the CLI and any web landing copy agree on the same first-run promise.

Acceptance criteria:
- A new user can install Carina globally and get to a usable session quickly.
- The first-run experience feels like a product, not a configuration exercise.
- The flow is stable enough to publish publicly.

