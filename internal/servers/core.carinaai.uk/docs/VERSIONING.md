# Versioning policy

Carina follows [Semantic Versioning 2.0.0](https://semver.org/) for published packages (`@carina/core`, CLI npm package, Homebrew formula).

## Version components

- **MAJOR**: breaking API, CLI flag removal, or incompatible config schema changes.
- **MINOR**: new features, channels, or tools without breaking existing callers.
- **PATCH**: bug fixes, docs, performance, non-breaking dependency updates.

## Pre-1.0

While below `1.0.0`, MINOR bumps may include breaking changes; document them in `BREAKING_CHANGES.md` and changelog.

## What we version

| Artifact | Source of truth |
|----------|-----------------|
| npm `@carina/core` | `core.carinaai.uk/package.json` |
| CLI | same package `bin` field |
| Docs site | tag matching release |
| Homebrew | `scripts/release/homebrew/carina.rb.template` |

## Release tags

Git tags: `vX.Y.Z` on the Carina monorepo subtree or product repo per your deploy standard.

## Changelog

Generated via:

```bash
./scripts/release/generate-changelog.sh [from-tag] [to-ref]
```

Manual notes for security fixes and operator-facing changes belong in `CHANGELOG.md` at repo root.
