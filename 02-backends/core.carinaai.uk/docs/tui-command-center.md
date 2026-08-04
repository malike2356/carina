# Carina TUI Command Center

The Carina TUI Command Center is the target contract for the terminal operator experience. It keeps the existing Carina chat, approval, Scout, session, model, and operator workflows, while adding stronger runtime inspection and review tools.

The source contract lives in `src/tui/contracts/command-center-contract.ts`. It is intentionally non-blocking at the start of the upgrade pack. Areas marked `missing` document what remains to build; areas marked `partial` document capability that exists but still needs a shared Command Center contract.

Run the current report from `02-backends/core.carinaai.uk`:

```bash
bash scripts/check-tui-command-center.sh
```

For the focused TUI suite without the contract report:

```bash
pnpm exec vitest run src/tui
```

The report tracks:

1. Command registry and slash fallthrough.
2. Runtime transport proximity.
3. Renderer contracts and benchmarks.
4. Command Center cockpit.
5. Runtime timeline.
6. Tool cards with redaction and details.
7. Session map and branch navigation.
8. Review mode, search, export, and copy.
9. Debug overlay.
10. Fault injection, long-session behavior, terminal matrix, and overlay recovery.
11. Carina splash, logo, appearance, and marketing alignment.
