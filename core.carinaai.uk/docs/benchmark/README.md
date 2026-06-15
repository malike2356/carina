# Carina platform benchmarks

Repeatable capability benchmarks for public proof. These are **measured** runs against the installed Carina kernel, not marketing copy.

## Run locally

```bash
carina benchmark run
carina benchmark regression
carina benchmark compare --json
carina benchmark public > docs/benchmark/latest.public.json
```

Outputs are written to `~/.carina/benchmarks/`:

| File | Purpose |
|------|---------|
| `latest.md` | Markdown report for docs and marketing |
| `latest.public.json` | Redacted JSON for website embeds |
| `bench-<timestamp>.json` | Full run archive |

## What is measured

Identical static probes every run (no LLM calls):

- Tools, skills, channels (counts and catalog health)
- Memory backends and session search
- Provider routing registry
- Session profiles and gateway recall
- Cron tools, workflow engine, scheduler
- Learning events, curator, cross-agent propagation
- Scout security integration and tool RBAC
- Hub marketplace catalog

## Competitor columns

Hermes, OpenClaw, and Odysseus columns in comparison tables are **published reference scores** from gap analysis docs. They are not live benchmark runs against those products in this harness.

Use Carina task scores and regression results for defensible claims.

## CI regression

```bash
pnpm benchmark:regression
```

Fails when closed-gap floors regress (for example tools < 99, skills < 115, channels < 50).

## Publishing

1. Run `carina benchmark run` on a clean checkout after `pnpm build`.
2. Copy `~/.carina/benchmarks/latest.md` into your docs site.
3. Embed `latest.public.json` in marketing pages or ops dashboards.
