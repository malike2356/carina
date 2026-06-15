# Good first issues (kernel backlog)

Five scoped starter tasks for the public [carina-agent](https://github.com/malike2356/carina-agent) repository. Each is completable in one PR by a new contributor.

File these on GitHub with label `good first issue`. **Filed (2026-06-14):**

| # | GitHub | Title |
|---|--------|-------|
| 1 | [#9](https://github.com/malike2356/carina-agent/issues/9) | docs: clarify kernel vs Scout in getting started guide |
| 2 | [#10](https://github.com/malike2356/carina-agent/issues/10) | feat: add hello-world domain pack template |
| 3 | [#11](https://github.com/malike2356/carina-agent/issues/11) | docs: add examples to carina --help |
| 4 | [#12](https://github.com/malike2356/carina-agent/issues/12) | docs: document channel adapter interface with IRC example |
| 5 | [#13](https://github.com/malike2356/carina-agent/issues/13) | test: add coverage for tool registration edge cases |

To re-file (avoid duplicates), use the bodies in `0*.md` below.

| # | File | Title | Labels | Effort |
|---|------|-------|--------|--------|
| 1 | [01-docs-getting-started-clarity.md](./01-docs-getting-started-clarity.md) | docs: clarify kernel vs Scout in getting started guide | `good first issue`, `documentation` | 1 to 2 h |
| 2 | [02-pack-template-hello-world.md](./02-pack-template-hello-world.md) | feat: add hello-world domain pack template | `good first issue`, `pack` | 2 to 3 h |
| 3 | [03-cli-help-examples.md](./03-cli-help-examples.md) | docs: add examples to carina --help and subcommand help | `good first issue`, `cli` | 2 to 4 h |
| 4 | [04-channel-adapter-stub.md](./04-channel-adapter-stub.md) | docs: document channel adapter interface with IRC example | `good first issue`, `channel` | 2 to 3 h |
| 5 | [05-tool-registry-test.md](./05-tool-registry-test.md) | test: add coverage for tool registration edge cases | `good first issue`, `test` | 1 to 2 h |

## Filing on GitHub

If `gh` is authenticated:

```bash
cd core.carinaai.uk
bash docs/kernel/good-first-issues/file-issues.sh
```

Or file manually: copy the body from each `0*.md` file (below the frontmatter) and set title and labels from the frontmatter.

## Scope rules

- Kernel only: tools, packs, channels, CLI, docs, tests
- Out of scope: Scout server, ops panel, hosted Cloud secrets

See [CONTRIBUTING.md](../../../CONTRIBUTING.md) and [BRAND_RULES.md](../BRAND_RULES.md).
