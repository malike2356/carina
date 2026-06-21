# Gap 18 - Prompt 02: Slash Commands & Management UI

**Gap:** 18 Standing Orders & Persistent Directives
**Prompt number:** 02 of 02
**Name:** /standing-orders slash command + admin UI
**Primary agent:** Claude Code
**Estimated hours:** 1-2 h
**Depends on:** 01-standing-orders-core.md

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `agents/standing-orders-store.ts` -- Store from prompt 01
2. `agents/command-handler.ts` -- slash command dispatch
3. `cli/commands.ts` -- CLI command registry

---

## Goal

Add user-facing controls for managing standing orders.

### 1. Slash Commands (chat)

In `agents/command-handler.ts`:

```typescript
// /standing-orders add <directive>       -- add a new order
// /standing-orders list                  -- list all orders
// /standing-orders remove <id>           -- remove an order
// /standing-orders toggle <id>           -- enable/disable toggle
// /standing-orders expire <id> <ISO>     -- set expiration

async handleStandingOrdersCommand(
  sessionId: string,
  agentId: string,
  args: string[],
): Promise<string> {
  const subCommand = args[0]?.toLowerCase();
  const store = this.standingOrdersStore;

  switch (subCommand) {
    case 'add': {
      const directive = args.slice(1).join(' ');
      if (!directive || directive.length < 3) {
        return 'Usage: /standing-orders add <directive text>';
      }
      if (directive.length > 2000) {
        return 'Directive too long (max 2000 characters).';
      }
      const order = await store.add({
        agentId,
        directive,
        priority: 0,
        enabled: true,
        source: 'user',
      });
      return `Standing order #${order.id.slice(0, 8)} added: "${order.directive}"`;
    }

    case 'list': {
      const orders = await store.list(agentId);
      if (orders.length === 0) return 'No standing orders set.';
      return orders.map(o =>
        `[${o.id.slice(0, 8)}] ${o.enabled ? '●' : '○'} ${o.directive}` +
        (o.metadata?.expiresAt ? ` (expires ${new Date(o.metadata.expiresAt).toLocaleDateString()})` : '')
      ).join('\n');
    }

    case 'remove': {
      const id = args[1];
      if (!id) return 'Usage: /standing-orders remove <id>';
      const removed = await store.remove(id);
      return removed ? `Order ${id} removed.` : `Order ${id} not found.`;
    }

    case 'toggle': {
      const id = args[1];
      if (!id) return 'Usage: /standing-orders toggle <id>';
      const order = await store.get(id);
      if (!order) return `Order ${id} not found.`;
      await store.update(id, { enabled: !order.enabled });
      return `Order ${id} ${order.enabled ? 'disabled' : 'enabled'}.`;
    }

    case 'expire': {
      const id = args[1];
      const iso = args[2];
      if (!id || !iso) return 'Usage: /standing-orders expire <id> <ISO timestamp>';
      const expiresAt = new Date(iso).getTime();
      if (isNaN(expiresAt)) return 'Invalid date format. Use ISO 8601 (e.g., 2026-07-01T00:00:00Z).';
      await store.update(id, { metadata: { expiresAt } });
      return `Order ${id} will expire at ${new Date(expiresAt).toISOString()}.`;
    }

    default:
      return 'Usage: /standing-orders <add|list|remove|toggle|expire>';
  }
}
```

### 2. CLI Commands

In `cli/commands.ts`:

```
carina standing-orders add <directive> [--agent <id>] [--priority <n>]
carina standing-orders list [--agent <id>] [--json]
carina standing-orders remove <id>
carina standing-orders toggle <id>
carina standing-orders expire <id> <ISO-timestamp>
carina standing-orders cleanup              Force-run expiry cleanup
```

### 3. Admin UI (Ops Panel)

Add a "Standing Orders" page to `internal/admin/ops.carinaai.uk/routes/`:

- List all orders across all agents with filter/search
- Add/edit/remove/toggle buttons
- Shows creation date, source, expiry status
- Batch operations (enable all, disable all for agent)

---

## Existing Carina code to integrate with

- `agents/command-handler.ts` -- register `/standing-orders` handler
- `cli/commands.ts` -- register CLI command group
- `internal/admin/ops.carinaai.uk/routes/` -- new standing-orders route
- `agents/standing-orders-store.ts` -- from prompt 01
