# Carina Workspace

This is the VERLOX Carina workspace. The repo root is kept small; most work belongs in `01-devends/`, `02-backends/`, `03-frontends/`, or `scripts/`.

## Directory Map

| Path | Purpose |
|---|---|
| `01-devends/` | Planning, prompt library, resources, SOPs, RAG material, tool catalogues |
| `02-backends/` | Core server products, ops/admin services, Scout, keys server, supporting backends |
| `03-frontends/` | Customer apps, marketing sites, docs, SDKs, integrations |
| `scripts/` | Workspace scripts, deploy helpers, public repo utilities |

## Prompt Library

All development prompts belong in `01-devends/prompts-library/`.

| Path | Purpose |
|---|---|
| `01-devends/prompts-library/01-pending_prompts/` | Work that still needs implementation or verification |
| `01-devends/prompts-library/02-archived_prompts/` | Completed, superseded, or historical prompts |
| `01-devends/prompts-library/03-reusable_prompts/` | Reusable prompts that help developers reproduce patterns |
| `01-devends/prompts-library/04-source_chats/` | Agent chats, discussions, and reasoning sources behind prompts |

After prompt changes, run:

```bash
python3 01-devends/prompts-library/scripts/build-prompt-index.py
```

Read `01-devends/prompts-library/00-library-docs/AGENT-RULES.md` before adding or moving prompt files.

## Common Commands

```bash
git status --short --branch
```

Deploy the full production stack:

```bash
bash scripts/deploy-carina.sh
```

Deploy only public marketing sites:

```bash
bash scripts/deploy-marketing.sh all
```

## Current Product Split

- Carina, Aiva, and Scout are the commercial product stack.
- Mutant and Petraclus are separate open-source or community product tracks unless explicitly integrated.
- Keep product boundaries clear in code, prompts, docs, and marketing.

## Contact

Verlox Ltd: [contact@verlox.uk](mailto:contact@verlox.uk)
