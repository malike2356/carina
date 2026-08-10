# Shared status page and incident communication

TypeScript library for downtime detection, incident timelines, maintenance windows, notifications, and a static status page.

## Usage

```ts
import {
  StatusStore,
  runHealthCycle,
  scheduleMaintenance,
  notifyActiveUsers,
  renderStatusPageHtml,
  buildStatusPageModel,
} from './index.js';
```

Vendored into Carina as `src/status/`. Keprix ships Python parity under `src/keprix/status_page/`.
