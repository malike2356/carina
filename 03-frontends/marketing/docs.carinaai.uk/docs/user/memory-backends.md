---
sidebar_position: 4
---

# Memory backends

Carina supports pluggable episodic memory stores.

| Backend | When to use |
|---|---|
| `builtin` (default) | Postgres + pgvector, or SQLite in local mode |
| `honcho` | [Honcho](https://honcho.dev) cloud memory |
| `mem0` | [Mem0](https://mem0.ai) cloud or self-hosted |

```bash
carina memory backends
carina memory use builtin
carina memory test
```

Set `CARINA_MEMORY_BACKEND` in `~/.carina/.env`. RAG vectors still use Postgres when available.

Developer details: [Memory architecture](/docs/developer/architecture/memory).
