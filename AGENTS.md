# Repository Guidelines

## Writing style (hard constraint)

Never use em dashes (U+2014) or en dashes (U+2013). Use `;`, `:`, `,`, `-`, parentheses, or sentence breaks instead. Never use emojis anywhere. See `/opt/lampp/htdocs/verlox/AGENTS.md` and run `python3 ../scripts/fix-writing-style.py` after bulk doc edits.

## Project Structure & Module Organization

This is the VERLOX Carina monorepo. Product code lives in `core.carinaai.uk/`, a Node.js/TypeScript agent with CLI entry points in `bin/`, source in `src/`, and product data in `brain/`. Public documentation is `docs.carinaai.uk/` (Docusaurus; user + developer guides). Legacy VitePress sources remain in `core.carinaai.uk/docs/` (deprecated; edit `docs.carinaai.uk/` instead). The private operations panel is `ops.carinaai.uk/`, with Express routes in `routes/`, helpers in `lib/`, EJS templates in `views/`, and CSS generated to `public/styles.css`. Labyrinth Scout lives in `console.labyrinthscout.com/`, with server code in `src/` and dashboard/static assets in `public/`. The Carina mobile companion is `carinaMobile/` (Expo Router; general-purpose default). Deployment scripts are in `scripts/`. Agent runtime knowledge is in `core.carinaai.uk/src/platform/platform-knowledge.md`.

## Build, Test, and Development Commands

Use package-local commands from the relevant directory.

- `cd docs.carinaai.uk && pnpm start`: Docusaurus docs site (user + developer).
- `cd core.carinaai.uk && pnpm docs:dev`: alias to Docusaurus dev server.
- `cd core.carinaai.uk && pnpm dev`: run the Carina agent in watch mode.
- `cd core.carinaai.uk && pnpm carina`: run the CLI entry point.
- `cd core.carinaai.uk && pnpm build`: compile TypeScript and copy gateway web assets.
- `cd core.carinaai.uk && pnpm test`: run Vitest tests (5,369 as of 2026-06-10).
- `cd console.labyrinthscout.com && pnpm dev`: run Scout in watch mode.
- `cd console.labyrinthscout.com && pnpm typecheck && pnpm test`: validate Scout before changes ship.
- `cd ops.carinaai.uk && pnpm dev`: run the VERLOX ops panel on port 4000.
- `cd ops.carinaai.uk && pnpm css`: rebuild Tailwind output for EJS views.
- `cd carinaMobile && pnpm start`: Expo dev server for the Carina mobile app.
- `cd carinaMobile && pnpm test`: Vitest for mobile config and API helpers.

## Coding Style & Naming Conventions

Code is TypeScript ESM. Match local style: two-space indentation, semicolons, single quotes, named exports for shared helpers, and explicit types at module boundaries. Keep Express route files grouped by feature, for example `routes/settings.ts` or `src/api/events.ts`. Tests use `*.test.ts` beside the code they cover.

## Testing Guidelines

Vitest is the active test framework for `core.carinaai.uk/` and `console.labyrinthscout.com/`. Core tests include V8 coverage with current thresholds of 60% lines and 60% functions. Add tests for agent tools, security policy, API handlers, and regression-prone wiring. Run the package’s `pnpm test` before handing off; run `pnpm typecheck` where available.

## Commit & Pull Request Guidelines

Git history uses short imperative subjects, often with Conventional Commit scopes: `fix(deploy): ...`, `docs(security): ...`, `feat: ...`, `chore: ...`. Keep commits focused. Pull requests should state the affected product area, list validation commands, link any issue or prompt, and include screenshots for ops panel or public UI changes.

## Security & Configuration Tips

Never commit real `.env` files, API keys, `.htpasswd`, or credentials. Use the existing `.env.example` files in `core.carinaai.uk/`, `ops.carinaai.uk/`, and `console.labyrinthscout.com/`. Preserve Scout/Carina trust boundaries: Carina reports sanitized telemetry; Scout control actions must remain scoped and auditable.
