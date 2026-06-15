---
title: "docs: add examples to carina --help and subcommand help"
labels:
  - good first issue
  - cli
---

## Context

The CLI entry point is `bin/carina.ts`, which delegates to `src/cli/registry.ts` and `src/cli/help.ts`. Top-level help lists commands but many newcomers do not know typical invocations for `setup`, `chat`, `packs`, `gateway`, or `ingest`.

## Task

Improve help output with **2 to 3 examples per major subcommand** when running:

```bash
carina --help
carina help setup
carina help chat
carina help packs
carina help gateway
```

## Files to touch

- `src/cli/help.ts` (primary: extend `buildHelpText` and/or `buildCommandHelp`)
- `src/cli/registry.ts` (optional: add `examples?: string[]` to `CliCommand` type in `src/cli/types.ts`)
- `src/cli/registry.test.ts` or new `src/cli/help.test.ts` for snapshot or string assertions

## Suggested examples

| Command | Example lines |
|---------|----------------|
| setup | `carina setup` |
| chat | `carina chat`, `carina` (default) |
| packs | `carina packs list`, `carina packs enable property-uk` |
| gateway | `carina gateway start`, `carina channels status` |
| ingest | `carina ingest --pack property-uk` |

Keep examples accurate to shipped CLI behavior; grep `buildCommands()` for real subcommand names.

## Acceptance criteria

- [ ] `carina --help` includes an **Examples** section with at least 6 example lines
- [ ] `carina help <command>` prints examples for at least 5 commands
- [ ] Help text fits in 80 columns where practical
- [ ] Tests assert presence of key example strings
- [ ] No emojis in help output

## Test

```bash
cd core.carinaai.uk
pnpm build
node dist/bin/carina.js --help | head -60
node dist/bin/carina.js help setup
pnpm test src/cli/
```
