# Playbook

**Playbook** is Carina's hardware-aware model discovery and serve helper. It detects your GPU, VRAM, CPU, and storage, then recommends local models that fit and shows how to pull or serve them.

## Surfaces

| Surface | Path |
|---------|------|
| Web workspace | `/playbook` |
| CLI | `carina playbook` |
| API | `/api/playbook/*` (legacy alias: `/api/cookbook/*`) |

Legacy `/cookbook` URLs redirect to `/playbook`.

## CLI

```bash
carina playbook                          # hardware profile + top recommendations
carina playbook list [--all]             # catalog entries that fit your machine
carina playbook search <query>           # search the model catalog
carina playbook inspect <id>             # details for one catalog entry
carina playbook serve <id> [--via ollama|llama.cpp|vllm|lm-studio] [--execute]
```

`carina cookbook` remains as a deprecated alias and prints a notice pointing to `carina playbook`.

## Concepts

| Concept | User-facing name | Notes |
|---------|------------------|-------|
| Hardware model matching | Playbook | Capability map for local models |
| Task routing (paths, scoring) | Playbook evaluate | Situational decision engine (when enabled) |
| Business / domain decisions | Domain plays | Policy and response paths |

The internal hardware catalog module (`src/cookbook/`) powers Playbook hardware recommendations. That code path is not user-facing; **Playbook** is the product term everywhere operators see it.

## Hardware capability

Open **Playbook** in the workspace sidebar or run `carina playbook` to see:

1. Detected hardware tier (GPU VRAM, RAM, disk headroom)
2. Recommended local models that fit
3. Configured cloud provider options
4. Serve commands for Ollama, llama.cpp, vLLM, or LM Studio

Use **Capability map** in the web UI to browse the full catalog, filter by fit, and open the serve panel for a selected model.
