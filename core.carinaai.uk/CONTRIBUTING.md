# Contributing to Carina

Thank you for helping improve Carina.

## Development setup

1. Node.js 22+ and pnpm 9+
2. PostgreSQL 16 with pgvector and Redis 7
3. Clone the repo and run `pnpm install && pnpm build`

## Code style

- Functions under 20 lines; classes under 200 lines
- PascalCase classes, camelCase methods, kebab-case tool names
- DTOs over raw objects between layers
- Tests document behaviour, not implementation

## Adding a tool

1. Create `src/tools/your-tool.ts` implementing the tool schema
2. Register in `src/tools/index.ts`
3. Add docs under `docs/tools/your-tool.md`

Tool schemas must be MCP-compatible JSON Schema.

## Publishing a skill pack

1. Create a directory with `pack.json` and `knowledge/**/*.md` files
2. Run validation: no API keys or credentials in content
3. Publish via Skills Hub API with a publish key, or open a PR to include in the official catalog

## Pull requests

- Run `pnpm test` and `pnpm build` before submitting
- One feature per PR where possible
- Update docs for user-facing changes
