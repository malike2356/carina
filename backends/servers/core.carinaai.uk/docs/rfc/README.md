# RFC index

Request for Comments (RFCs) propose changes to the Carina kernel stable API, tool categories, and pack manifest contracts before implementation.

## Process

1. **Draft in GitHub Discussions** (category: RFCs) for early feedback, or go straight to a file PR.
2. **Create an RFC file**: `carina rfc propose "Your title"` (copies `0000-template.md` with the next number).
3. **Open a PR** with the RFC markdown only; do not merge implementation in the same PR unless trivial.
4. **Review**: maintainers mark status `Accepted`, `Rejected`, or `Superseded` in the RFC header.

Full guide: [RFC process on docs.carinaai.uk](https://carinaai.uk/docs/developer/rfc-process)

## When an RFC is required

- New stable `@verlox/carina-core` export or breaking change (see [STABLE_API.md](../kernel/STABLE_API.md))
- New tool category or registry contract change
- Breaking `pack.json` manifest field (major semver)

## When an RFC is not required

- Bug fixes, documentation, tests
- New optional pack manifest fields (minor semver)
- New domain pack content (hub publish)

## Community channels

| Channel | Purpose |
|---------|---------|
| [GitHub Discussions](https://github.com/malike2356/carina-agent/discussions) | Q&A, RFC pre-review, show-and-tell |
| Discord | Placeholder: invite URL TBD; watch Discussions for announcement |
| Slack | Placeholder: workspace TBD |
| Community call | Schedule TBD; watch GitHub Discussions |

## RFC files

| RFC | Title | Status |
|-----|-------|--------|
| (none yet) | Run `carina rfc list` after proposing | |
