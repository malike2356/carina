---
sidebar_position: 3
---

# RFC process

Request for Comments (RFCs) are how we propose changes to the **stable** Carina kernel API before code lands. RFCs complement GitHub Issues (bugs) and Pull Requests (implementation).

## Quick start

```bash
carina rfc propose "Add legal-uk pack manifest v2 fields"
# Created docs/rfc/0001-add-legal-uk-pack-manifest-v2-fields.md
carina rfc list
```

Edit the generated file, then open a **PR with the RFC only** for review. Do not auto-commit from the CLI; you control git.

## When an RFC is required

| Change | RFC? |
|--------|------|
| New stable `@verlox/carina-core` export | Yes |
| Breaking change to [stable API](/docs/developer/stable-api) | Yes |
| New tool category or registry contract | Yes |
| Breaking `pack.json` manifest field (major semver) | Yes |
| Bug fix, docs, tests | No |
| New optional pack manifest field (minor semver) | No |
| New domain pack content (hub publish) | No |

RFCs must cite a **Target API version** (for example `@verlox/carina-core 0.2.0`). See [STABLE_API.md](https://github.com/malike2356/carina-agent/blob/main/docs/kernel/STABLE_API.md).

## Workflow

1. **Optional pre-review**: open a GitHub Discussion in the **RFCs** category with a short summary and link to your draft idea.
2. **Draft file**: `carina rfc propose "Title"` copies `docs/rfc/0000-template.md` with the next RFC number.
3. **Fill sections**: Summary, Motivation, Design, Drawbacks, Alternatives.
4. **Pull request**: submit the markdown file; link related issues.
5. **Outcome**: maintainers update `- Status:` to `Accepted`, `Rejected`, or `Superseded`.

Accepted RFCs may be implemented in follow-up PRs. Keep implementation PRs separate when the change is non-trivial.

## RFC template fields

```markdown
# RFC-NNNN: Title

- Status: Draft | Accepted | Rejected | Superseded
- Author:
- Created: YYYY-MM-DD
- Target API version: @verlox/carina-core 0.x
```

## Community channels

| Channel | Status |
|---------|--------|
| [GitHub Discussions](https://github.com/malike2356/carina-agent/discussions) | Active (Q&A template available) |
| GitHub Discussions **RFCs** category | Use for pre-PR feedback |
| Discord | Placeholder: invite URL TBD |
| Slack | Placeholder: workspace TBD |
| Community call | Schedule TBD; watch GitHub Discussions |

Do not invent invite URLs until channels are officially announced.

## Related docs

- [Stable public API](/docs/developer/stable-api)
- [Contributing](/docs/user/contributing)
- [Publishing a pack](/docs/developer/publishing-a-pack)

RFC files live in `docs/rfc/` in the [carina-agent](https://github.com/malike2356/carina-agent) repository and are included in the public export.
