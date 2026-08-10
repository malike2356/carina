# Conveyor (Carina)

Vendored from `shared/conveyor/`.

```bash
pnpm conveyor:audit
pnpm exec tsx src/conveyor/cli.ts audit /path/to/prototype
```

Ops: `GET /api/ops/conveyor/audit`, `GET /api/ops/conveyor/status`, `POST /api/ops/conveyor/pipeline` (requires `humanApproval: true` to leave awaiting_approval).
