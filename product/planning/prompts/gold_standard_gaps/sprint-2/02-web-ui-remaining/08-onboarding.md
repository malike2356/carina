Use this prompt:

  You are working in the VERLOX Carina monorepo at /opt/lampp/htdocs/verlox/carina.

  Goal
  Design and implement a frictionless onboarding experience for both Carina and Scout. The onboarding must feel like
  one guided action that gets a new user from zero to fully usable in as few steps as possible. Prefer a one-step done
  and complete approach over multi-page setup forms.

  Primary outcomes
  1. A new user can enter the product and reach a working state with minimal typing.
  2. Carina onboarding should create or unlock a usable workspace, connect core services, and land the user in the
  main app.
  3. Scout onboarding should provision or connect the Scout engine, validate live connectivity, and land the user in
  the security/ops surface.
  4. The first successful path must be obvious, fast, and resilient to missing config.
  5. Existing users should skip onboarding entirely once setup is complete.

  Product principles
  - One primary action per screen.
  - Default everything that can be safely defaulted.
  - Ask only for information that cannot be inferred.
  - Auto-detect environment state, installed services, and missing credentials where possible.
  - Use progressive disclosure for advanced setup only after the main flow succeeds.
  - Prefer completion over configuration. The user should get a usable system first, then refine settings later.
  - Keep Carina and Scout clearly separated in the UI and in the code, but make the handoff between them seamless.

  What to build
  1. A unified onboarding flow for Carina
  - First run detects whether the user is new.
  - If new, show a single onboarding surface with one clear primary action.
  - The flow should create the workspace, configure defaults, and take the user into the main product.
  - Reduce form fields to the minimum.
  - Any optional settings must be hidden behind an advanced section.

  2. A unified onboarding flow for Scout
  - Detect whether Scout is running and reachable.
  - If not running, show a direct fix path that starts or connects it.
  - If running, validate the connection and continue.
  - After success, take the user directly to the security or ops view with live data.
  - Do not leave the user on an error-only page when recovery is possible.

  3. A single onboarding state model
  - Track onboarding status in a simple, explicit way.
  - Support states like:
    - not_started
    - in_progress
    - needs_connection
    - ready
    - complete
    - failed
  - Persist completion so users do not repeat onboarding.

  4. Automatic service detection
  - Detect available core services, Scout engine, auth, database, and any required env values.
  - If a dependency is missing, present the smallest possible recovery action.
  - If the dependency can be inferred or bootstrapped, do that automatically.

  5. Frictionless defaults
  - Pre-fill sensible defaults for workspace name, instance name, and basic preferences.
  - Auto-generate secrets only when safe and appropriate.
  - Avoid asking for separate Carina and Scout setup details if they can share context.
  - Use a single identity path where possible, then branch only when necessary.

  6. Clear completion
  - After onboarding completes, show a concise success state and redirect into the product.
  - The success state should not become a dead-end.
  - The user should immediately see something useful, not an empty shell.

  Repository constraints
  - Follow the existing repo structure and conventions.
  - Keep Carina, Scout, internal ops, external client, and marketing boundaries clear.
  - Do not put server logic in client modules.
  - Do not add unnecessary abstractions.
  - Keep changes localized to the onboarding path, shared state, and any required backend endpoints.
  - Preserve existing product behavior outside onboarding unless a change is required for the flow to work.
  - Do not break current auth, proxying, or deployment behavior.

  UI requirements
  - Make the onboarding feel fast and obvious.
  - Use a single primary CTA.
  - Use a compact layout that works on mobile and desktop.
  - Avoid clutter and multi-column forms unless there is a strong reason.
  - Show live status during setup.
  - If a background step is running, make that visible and actionable.
  - If a step fails, show a direct retry or repair path.

  Backend requirements
  - Add or reuse APIs that let the UI:
    - detect onboarding state
    - create or complete onboarding
    - check Scout/Core connectivity
    - trigger any required bootstrap action
  - Ensure the APIs are secure and authenticated appropriately.
  - If the app needs to talk to the core proxy or Scout engine, wire that cleanly and fail gracefully.

  Deliverables
  1. Implement the onboarding flow in the relevant Carina and Scout surfaces.
  2. Add or update backend endpoints needed for onboarding state and service checks.
  3. Persist onboarding completion.
  4. Add tests for:
    - first-time onboarding
    - already-completed onboarding
    - missing Scout/Core dependency
    - successful automatic recovery
  5. Update any docs or env examples only if necessary for the flow to work.
  6. Keep the final experience simple enough that a new user can complete setup in one guided pass.

  Acceptance criteria
  - A new user can start onboarding and reach a working Carina state without navigating multiple setup pages.
  - A new Scout connection can be established or validated from the same flow without manual hunting through settings.
  - Existing users do not see onboarding again once complete.
  - Missing services or config are handled with clear recovery, not dead ends.
  - The default path should succeed with one action and minimal interruption.
  - Tests pass for the onboarding flow and the affected endpoints.

  Implementation approach
  1. Inspect current onboarding, auth, workspace creation, and Scout connection flows.
  2. Identify the shortest path from first visit to ready state.
  3. Replace scattered setup screens with one coordinated onboarding surface where possible.
  4. Add the smallest backend support needed for state and recovery.
  5. Wire redirects so successful completion lands the user in the main product.
  6. Add focused tests.
  7. Keep the code changes clean and limited to onboarding-related areas.

  Important
  - Do not invent a long wizard.
  - Do not add marketing language to the onboarding UI.
  - Do not make users decide between too many options up front.
  - Do not assume Scout is always running.
  - Do not assume core proxy credentials always exist.
  - The ideal result is: one clear action, automatic setup, immediate value.

