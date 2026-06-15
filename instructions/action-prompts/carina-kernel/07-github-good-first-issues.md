# Carina Kernel Phase 1: GitHub good first issues

## Goal

Define and file five "good first issue" GitHub issues (as markdown templates in-repo until filed on GitHub) for the public `carina-agent` repository.

## Context

- CONTRIBUTING.md from prompt `06`
- Real gaps suitable for newcomers: docs typos, pack template, CLI help text, channel adapter stub, test coverage
- Issues must be kernel-scoped (not Scout server, not ops panel)
- Use `gh issue create` if `gh` is authenticated; otherwise commit issue bodies for manual filing

## Dependencies

`06-contributing-public-repo.md`

## Files to create

- `core.carinaai.uk/.github/ISSUE_TEMPLATE/good_first_issue.md` (meta template)
- `core.carinaai.uk/docs/kernel/good-first-issues/` (five issue body files ready to paste)

## Step-by-step

1. Create five issue spec files with title, labels, and body:

   **Issue 1: `01-docs-getting-started-clarity.md`**
   - Title: `docs: clarify kernel vs Scout in getting started guide`
   - Labels: `good first issue`, `documentation`
   - Task: Update `docs.carinaai.uk/docs/user/getting-started.md` (or exported equivalent) so Scout is described as optional commercial layer

   **Issue 2: `02-pack-template-hello-world.md`**
   - Title: `feat: add hello-world domain pack template under src/skills/packs/template/`
   - Labels: `good first issue`, `pack`
   - Task: Minimal `pack.json` + one skill + README; validate with existing `pack-loader.ts`

   **Issue 3: `03-cli-help-examples.md`**
   - Title: `docs: add examples to carina --help and subcommand help`
   - Labels: `good first issue`, `cli`
   - Task: Improve `bin/carina.ts` help output with 2-3 examples per subcommand

   **Issue 4: `04-channel-adapter-stub.md`**
   - Title: `feat: document channel adapter interface with IRC stub example`
   - Labels: `good first issue`, `channel`
   - Task: Read `src/gateway/channels/` pattern; add `docs/developer/channel-adapter.md` + optional stub adapter behind feature flag

   **Issue 5: `05-tool-registry-test.md`**
   - Title: `test: add coverage for tool registration edge cases`
   - Labels: `good first issue`, `test`
   - Task: Add Vitest cases in `src/tools/` for duplicate registration and missing schema

2. Add `core.carinaai.uk/docs/kernel/good-first-issues/README.md` index linking all five with estimated effort (1-4 hours each).

3. If GitHub CLI is available and repo exists:

   ```bash
   cd core.carinaai.uk
   for f in docs/kernel/good-first-issues/0*.md; do
     # parse title from first line and body from rest; gh issue create ...
   done
   ```

   Otherwise document in README: "File these manually after public repo launch."

4. Add to CONTRIBUTING.md a "Good first issues" section linking the index.

## Expected behavior

- Five concrete, scoped issues exist before public launch
- Each issue is completable in one PR by a new contributor

## Test

- Five files exist under `docs/kernel/good-first-issues/`
- Each issue body includes: context, files to touch, acceptance criteria, test command
