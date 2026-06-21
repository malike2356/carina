Use this in Cursor:

  You are working in /opt/lampp/htdocs/verlox/carina/console.labyrinthscout.com.

  Goal
  Make Governance a first-class tab inside the main dashboard at /dashboard so operators can access Overview,
  Defense, and Governance from one screen. Right now Governance exists only as a separate /governance page and is
  too easy to miss. Move it into the dashboard tab strip without breaking the existing Overview and Defense views.

  Important context
  - The main dashboard is in public/dashboard.html.
  - The standalone governance page is in public/governance.html.
  - The governance data model already exists in src/governance/build-governance-posture.ts.
  - The dashboard already has two tabs: Overview and Defense.
  - The header already links to /governance, but users are missing it because it is not in the tab strip.
  - Do not remove the standalone /governance page. Keep it as a deep link and as a dedicated page for people who
  want the full view.
  - The goal is discoverability and workflow speed, not a redesign.

  What to change

  1. Add a third tab to the main dashboard
  - Update the tab strip in public/dashboard.html so it has:
    - Overview
    - Defense
    - Governance
  - Make Governance selectable like the other two tabs.
  - The active tab styling and tab switching logic must work for the new tab.

  2. Add a governance panel inside the dashboard page
  - Create a new dashboard view section, for example:
    - <div id="view-governance" class="dash-view">...</div>
  - Reuse the same governance posture data already used by the standalone governance page.
  - The tab should show the key governance summary directly in the main dashboard, not just a link out to /
  governance.
  - Include the core items people need to find quickly:
    - governance score
    - governance label
    - EU AI Act classification
    - UK DSIT alignment
    - governed agents summary
    - human oversight summary
    - action items
    - attestation timeline summary
    - governance template summary
  - Keep it compact and operational. This is a dashboard tab, not a marketing page.

  3. Reuse the existing governance logic
  - Do not duplicate logic if it can be reused cleanly.
  - Prefer extracting shared rendering helpers from the existing dashboard page and governance page if needed.
  - If the standalone governance page already has the exact rendering logic, factor the logic into a shared
  browser script or a small shared module and use it from both places.
  - Keep the implementation simple and local to the current app. Avoid large framework changes.

  4. Keep the standalone /governance page working
  - Do not break public/governance.html.
  - The standalone page should still render the full governance surface.
  - The dashboard tab can show a condensed version, but it must be real data, not a placeholder.

  5. Improve discoverability
  - Keep the existing header link to /governance if useful.
  - But the main action should be the new tab in the dashboard tab strip.
  - The dashboard should make governance visible immediately on page load.

  6. Update documentation if needed
  - If docs/dashboard.md or any dashboard notes describe only Overview and Defense, update them to mention
  Governance as a tab.
  - Keep docs short and factual.

  Files likely to touch
  - public/dashboard.html
  - public/governance.html
  - docs/dashboard.md
  - possibly one small shared JS file under public/dashboard/js/widgets/ or src/governance/ if you decide to
  extract reusable render logic

  Implementation guidance

  - Preserve the existing visual style.
  - Do not make the dashboard busier than necessary.
  - Do not introduce a new design system.
  - Use the same dark console styling, panels, and monospace labels already in use.
  - Keep the new Governance tab readable on desktop and mobile.
  - Make sure tab switching is deterministic and does not clash with the existing Overview and Defense behavior.

  Suggested behavior for the Governance tab
  - Top summary banner with governance score and label.
  - Two compact cards for EU AI Act and UK DSIT.
  - One card for governed agents and human oversight.
  - One card for action items.
  - One card for governance template or attestation summary.
  - Optional button or link to open the full /governance page for the detailed view.

  Acceptance criteria
  - /dashboard shows three tabs: Overview, Defense, Governance.
  - Clicking Governance swaps the visible panel without a page change.
  - Governance data renders in the dashboard tab on initial load.
  - /governance still works as a standalone page.
  - No console errors.
  - No existing dashboard behavior regresses.

  Validation
  After the change, run the relevant checks from the console.labyrinthscout.com directory. Prefer the repo's
  existing test and build commands. At minimum, verify the page loads and the tab switch works.

  Do the implementation now. Do not stop at a sketch. Do not leave the Governance tab as a dead link.

 

