---
sidebar_position: 2
---

# Memory backends

Episodic memory is pluggable. Configure with `CARINA_MEMORY_BACKEND`.

| Backend | Env | Notes |
|---|---|---|
| `builtin` (default) | `CARINA_MEMORY_BACKEND=builtin` | Postgres + pgvector, or SQLite in local mode |
| `postgres` | Direct Postgres store | Same tables as builtin full mode |
| `sqlite` | `CARINA_LOCAL_MODE=true` | File at `~/.carina/data/memory.sqlite` |
| `honcho` | `HONCHO_API_KEY`, `HONCHO_URL` | [Honcho](https://honcho.dev) API |
| `mem0` | `MEM0_API_KEY` or `MEM0_URL` | [Mem0](https://mem0.ai) cloud or OSS |

```bash
carina memory backends
carina memory use honcho
carina memory test
```

Implementation: `src/memory/backends/`. RAG vectors remain on Postgres when available; episodic recall routes through the active backend.
