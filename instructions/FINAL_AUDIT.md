You are auditing and completing the Carina build. Most features already exist. Your job is verification and gap-closure, not rebuilding.

WORKING DIRECTORY: /opt/lampp/htdocs/verlox/carina/core.carinaai.uk

STEP 1: Inventory. Run these and report what you find:
- pnpm exec tsc --noEmit (note any errors)
- pnpm exec vitest run (note any failures)
- cd ../console.labyrinthscout.com && npx tsc --noEmit && npx vitest run

STEP 2: Fix what's broken. The goal is zero errors, all tests green.
- Fix the TypeScript error in src/tools/cache.ts line 65 (string index type)
- Fix the 28 failing Scout tests (quarantine, rate-control; check if they're stale tests or real bugs)
- Do NOT touch tests that are already passing

STEP 3: Dashboard frontend. The Scout dashboard backend exists (src/dashboard/widgets/, src/api/dashboard.ts) but the HTML/CSS/JS frontend is missing. Build:
- public/dashboard/index.html; Security dashboard UI matching the spec in the action prompt
- public/dashboard/css/dashboard.css
- public/dashboard/js/dashboard.js; WebSocket client connecting to backend widgets
- Must include: agent status, threat metrics, live feed, kill switch button, audit log viewer
- Use Chart.js for charts, vanilla JS, no framework

STEP 4: Verify end-to-end. Run:
- node dist/bin/carina.js --version (must output "carina 0.1.0")
- node dist/bin/carina.js config list (must output config)
- pnpm build (must succeed)
- git diff --stat (review all changes)
- git add -A && git commit -m "fix: close remaining gaps; dashboard UI, test fixes, type errors"

STEP 5: Report. List exactly what you fixed, what tests now pass, and what (if anything) remains broken.
