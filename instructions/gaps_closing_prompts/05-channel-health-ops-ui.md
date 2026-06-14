# Prompt: Channel Health Dashboard in Ops Panel

## What to build

Surface the existing channel status data in the ops panel UI. The data layer is complete:
- `src/gateway/channels/channel-status.ts` - `getChannelStatusReport()` returns `ChannelStatusReport[]` with `state`, `active`, `transport`, `reason`, `webhook`, `env` per channel
- `src/gateway/channels/channel-status.test.ts` - tests exist for the data layer

The ops panel (`ops.carinaai.uk`) has no route or view for this data. The gap: no browser surface.

## What to add

### 1. New route in ops.carinaai.uk/routes/

Create `ops.carinaai.uk/routes/channels.ts`:

```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Dynamic import to avoid bundling core.carinaai.uk into ops at startup
    // Adjust the import path to point at the compiled core channel-status
    const { getChannelStatusReport } = await import('../../core.carinaai.uk/dist/gateway/channels/channel-status.js');
    const channels = getChannelStatusReport();
    res.render('channels', { channels });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).render('error', { message });
  }
});

export default router;
```

NOTE: if importing from the compiled dist is awkward (e.g. core is not always built), extract just the `getChannelStatusReport` function into a shared package or call the core's internal HTTP API instead. Pick the simplest approach that avoids duplicating the status logic. Document the chosen approach in a one-line comment.

### 2. Register the route in ops.carinaai.uk/server.ts

```typescript
import channelsRouter from './routes/channels.js';
// ...
app.use('/channels', requireAuth, channelsRouter);
```

### 3. Create ops.carinaai.uk/views/channels.ejs

Follow the layout of `security.ejs` or `dashboard.ejs`. Show a table with one row per channel:

| Channel | State | Active | Transport | Notes |
|---|---|---|---|---|
| telegram | connected | yes | webhook | ... |
| slack | disabled | no | - | SLACK_BOT_TOKEN not set |

State badge colours (CSS classes following the existing ops panel palette):
- `connected` - green
- `configured` - blue
- `partial` - yellow
- `disabled` - grey
- `error` - red
- `unsupported` - grey/muted

### 4. Add nav link in ops.carinaai.uk/views/layout.ejs or partials/nav.ejs

Add `<a href="/channels">Channels</a>` alongside the existing nav items.

## What NOT to build

Do not rebuild the data layer (`channel-status.ts` in core). Do not add a CLI - the CLI already exists. Only the browser surface is missing.

## Run after building

```bash
cd ops.carinaai.uk
pnpm dev
# Open http://localhost:4000/channels and verify the table renders
```
