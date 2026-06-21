## ADDENDUM; 2026-06-20: BUILD STATUS

**STATUS: FULLY BUILT (Migration) / FULLY BUILT (Obsidian)**

### MIGRATION-IMPLEMENTATION.md

All migration code exists in `src/ops/migration/` (7 files) + CLI:

| Component | File |
|-----------|------|
| Generic migrate() function | `migration/migrate.ts`; skills, config, cron, env merge |
| Auto-discovery | `migration/discovery.ts`; AgentSignature-based detection |
| Format-specific | `migration/claude.ts`; Claude migration |
| Export/import | `migration/interop-bundle.ts`; export/import bundles |
| CLI | `cli/commands/migrate-cli.ts` (175 lines); `carina migrate` command |

### OBSIDIAN-INTEGRATION.md

| Component | File | Lines |
|-----------|------|-------|
| Vault bootstrap | `integrations/obsidian-vault.ts` | 943 |
| Scout-Obsidian bridge | `integrations/scout-obsidian-bridge.ts` | Converts Scout findings to Obsidian cases |
| CLI | `cli/groups/obsidian.ts` | CLI commands |

Full frontmatter schemas, templates, playbooks, investigation notes, evidence notes, target profiles, daily logs, dashboard; all implemented.

### de-reference-competitor-names.md

**STATUS: PARTIALLY BUILT**

**Done:** Migration module uses neutral `agent-type-1`/`agent-type-2` codes. `.hermes`/`.openclaw` directory paths permitted per spec.

**Not done (7 files still contain competitor names):**
- `cross-agent-skills-cli.ts` imports from `hermes-hub`/`openclaw-hub`
- `discovery/search.ts` imports `hermesHubConnector`/`openclawHubConnector`
- Source filenames `hermes-hub.ts` and `openclaw-hub.ts` not renamed
- The adapter renames from the spec were not executed

### SCOUT-CARINA-ARCHITECTURE.md

**STATUS: PARTIALLY BUILT (as documented in the prompt itself)**

**Shipped:** Agent security (~67 files), telemetry shim, kill-switch listener, Scout CLI (9 commands), findings REST client, local investigation store, tool suggestion engine, TUI overlay, billing plan IDs.

**Planned:** Deep-scan/report/watch/connect CLI commands, Postgres `carina_investigations` table, evidence upload API, finding webhooks, scan engines, attack-surface dashboard views.
