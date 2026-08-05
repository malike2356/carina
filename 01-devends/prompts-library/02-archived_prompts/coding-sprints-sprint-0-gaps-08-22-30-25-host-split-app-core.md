# 25. Split app.carinaai.uk and core.carinaai.uk into distinct product surfaces

You are working in the Carina codebase. Split the product experience cleanly between `app.carinaai.uk` and `core.carinaai.uk`. Right now both hosts feel like the same web UI. That is wrong.

Goal:
- `app.carinaai.uk` is the hosted SaaS product for end users and orgs
- `core.carinaai.uk` is the private instance and operator surface
- Shared engine pages may exist on both, but the navigation, labels, defaults, and first-screen story must be different
- `ops.carinaai.uk` remains a separate operator console and must not be blended into app or core

Primary requirement:
Do not hide the difference only with CSS or copy. Split route ownership, shell chrome, menu structure, and host-level behavior.

Current problem to fix:
- Both hosts expose too much of the same nav
- Both hosts share the same visual hierarchy
- Cloud signup, billing, and tenant features are too visible on core
- Private instance controls and recovery are too hidden on app
- Users cannot immediately tell whether they are in hosted SaaS mode or private instance mode

Implement a host-mode architecture with explicit product surfaces.

1. Define product modes
- Add a first-class product mode or surface config, not just ad hoc hostname checks.
- Supported modes should include at least:
  - hosted
  - private
  - ops
- Mode must drive:
  - nav
  - title
  - branding
  - login copy
  - available routes
  - available API endpoints
  - default landing page
  - footer and install metadata
- Keep hostname detection as input, but do not rely on it alone for every decision.

2. Create a route ownership matrix
Make route ownership explicit and enforce it in code.

`app.carinaai.uk` owns:
- `/hosted-login`
- `/hosted-register`
- `/hosted-forgot`
- `/hosted-reset`
- `/billing`
- `/security`
- `/settings`
- `/dashboard`
- `/ops/*`
- `/api/cloud/*`
- `/api/auth/*`
- `/api/hosted/*`
- `/app/auth/*`
- `/webhooks/stripe`

`core.carinaai.uk` owns:
- `/login`
- `/logout`
- `/control`
- `/control/*`
- `/api/health`
- `/api/providers`
- `/api/config`
- `/api/ops/*`
- host-local diagnostics
- host-local recovery
- local admin and private instance controls

Shared pages may remain available on both only if the content is intentionally branded and scoped by mode:
- `/`
- `/chat`
- `/memory`
- `/notes`
- `/documents`
- `/images`
- `/calendar`
- `/compare`
- `/research`
- `/playbook`
- `/packs`
- `/webhooks`

For any shared route:
- render different chrome for hosted vs private mode
- do not show the same top nav, sidebar, or footer
- do not expose app-only links on core
- do not expose core-only links on app

3. Split the shell chrome
- Build separate shell configurations for hosted and private modes.
- Hosted shell should feel like a SaaS workspace:
  - account
  - org
  - billing
  - usage
  - Scout
  - upgrade
  - tenant settings
- Private shell should feel like an instance console:
  - login
  - control center
  - host status
  - local config
  - diagnostics
  - backups
  - recovery
- Remove noisy or irrelevant menu items from each host.
- Do not let settings and personalize overflow into the primary sidebar.
- Do not let login pages fight footer content for space.
- Keep the shell mobile-first and PWA friendly.

4. Separate the first screen story
Hosted app first screen:
- Carina Cloud or equivalent hosted branding
- clear sign in and create account flows
- BYOK messaging
- billing and plan context
- Scout security and trust messaging
- tenant or org context after sign-in

Private core first screen:
- private instance wording
- local sign in
- instance control and recovery
- no billing CTA
- no cloud signup CTA
- no hosted onboarding copy

5. Remove accidental overlap
- If a feature belongs to hosted SaaS, it must not appear as a prominent action on core.
- If a feature belongs to private instance management, it must not appear as a prominent action on app.
- If the same engine page is shared, the page must still adapt its copy, CTAs, and nav to the host mode.
- Do not leave duplicated menu groups that point to the same place under different labels.

6. Route and auth behavior
- Hosted auth must remain on the app surface.
- Private login must remain on the core surface.
- Keep compatibility aliases only if they are needed for migration, but do not let them define the product boundary.
- Ensure app routes require hosted account or tenant context where appropriate.
- Ensure core routes require private instance session or operator auth where appropriate.
- Do not let hosted billing or Scout provisioning leak into private core flows.

7. Data and feature boundaries
Hosted data and features:
- `hosted_users`
- `cloud_orgs`
- subscriptions
- org invites and roles
- Scout provisioning and tenant-scoped credentials
- hosted billing and usage
- hosted account recovery

Core data and features:
- local instance password
- host control settings
- local provider configuration
- operator diagnostics
- backup and restore
- import and export
- break-glass recovery

Keep shared runtime data out of the UI if it is not relevant to the current product mode.

8. Visual and content differences
Hosted app should emphasize:
- cloud account
- org and tenant
- plan and usage
- upgrade and billing
- Scout
- product value for customers

Private core should emphasize:
- instance status
- local access
- operator tools
- recovery
- configuration
- control center

Do not reuse the same hero copy, same nav order, or same CTA set on both.

9. Tests
Add tests for:
- route ownership by hostname or mode
- hosted login and register pages
- private login page
- app-only links not appearing on core
- core-only links not appearing on app
- different titles and headers by host
- shared workspace pages rendering different chrome by mode
- mobile viewport layout for both hosts
- redirect behavior for protected routes

Add snapshot or DOM-level checks that prove the two hosts are no longer visually identical.

10. Deployment behavior
- app and core must be deployable together from the same codebase, but with different runtime configuration.
- Do not require a separate repo to get the split right.
- Make the boundary obvious in config, not implicit in scattered conditionals.
- Update any deploy docs or environment examples so operators know which host is hosted SaaS and which host is the private instance.

Acceptance criteria:
- A user can tell in one screen whether they are in hosted SaaS or private instance mode.
- `app.carinaai.uk` and `core.carinaai.uk` no longer present the same shell or the same top-level navigation.
- Cloud billing, Scout, and hosted onboarding live on app only.
- Private instance recovery and host controls live on core only.
- Shared workspace pages remain available, but they are visibly branded and scoped by host.
- Tests prove the split.
- The UI feels intentional, not duplicated.
