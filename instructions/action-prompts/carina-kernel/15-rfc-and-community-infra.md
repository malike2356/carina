# Carina Kernel Phase 3: RFC process and community infrastructure

## Goal

Add contributor infrastructure: RFC workflow via `carina rfc propose`, GitHub Discussions templates, and documented community channels.

## Context

- Strategy: `CARINA_AS_LINUX.md` Phase 3 item 7
- CONTRIBUTING.md: prompt `06`
- Stable API: prompt `09` (RFCs must reference stable API versions)
- Discord/Slack: create placeholder docs until channels exist (do not invent invite URLs)

## Dependencies

`06-contributing-public-repo.md`, `09-stable-public-api-semver.md`

## Files to create

- `core.carinaai.uk/src/cli/commands/rfc/propose.ts`
- `core.carinaai.uk/src/cli/commands/rfc/list.ts`
- `core.carinaai.uk/docs/rfc/README.md`
- `core.carinaai.uk/docs/rfc/0000-template.md`
- `core.carinaai.uk/.github/DISCUSSION_TEMPLATE/q-and-a.yml`
- `docs.carinaai.uk/docs/developer/rfc-process.md`

## Files to modify

- `core.carinaai.uk/bin/carina.ts` (register `rfc` subcommand)
- `core.carinaai.uk/CONTRIBUTING.md` (RFC section)

## Step-by-step

1. Create RFC template `docs/rfc/0000-template.md`:

   ```markdown
   # RFC-NNNN: Title

   - Status: Draft | Accepted | Rejected | Superseded
   - Author:
   - Created: YYYY-MM-DD
   - Target API version: @verlox/carina-core 0.x

   ## Summary
   ## Motivation
   ## Design
   ## Drawbacks
   ## Alternatives
   ```

2. Implement `carina rfc propose "<title>"`:
   - Allocates next RFC number by scanning `docs/rfc/` for highest `NNNN`
   - Copies template to `docs/rfc/NNNN-slugified-title.md`
   - Opens `$EDITOR` if set, else prints path for manual edit
   - Prints instruction: "Open PR with this RFC file for community review"

3. Implement `carina rfc list`:
   - Lists RFC files with status from front matter

4. Document RFC process in `docs/developer/rfc-process.md`:
   - When RFC required: new stable API surface, new tool category, breaking pack manifest change
   - When RFC not required: bug fixes, docs, new optional pack fields (minor)
   - GitHub Discussions category "RFCs" for pre-PR feedback
   - Monthly community call: placeholder "Schedule TBD; watch GitHub Discussions"

5. Add GitHub Discussions template for Q&A.

6. Update CONTRIBUTING.md with RFC workflow link.

7. Vitest: `rfc propose` creates file with incremented number (temp dir fixture).

## Expected behavior

```bash
carina rfc propose "Add legal-uk pack manifest v2 fields"
# Created docs/rfc/0001-add-legal-uk-pack-manifest-v2-fields.md
```

## Test

```bash
cd core.carinaai.uk && pnpm test src/cli/commands/rfc/
carina rfc list
```

## Pitfalls

- RFC files live in repo; export script must include `docs/rfc/`
- Do not auto-commit RFC files from CLI; user opens PR manually
