# @verlox/carina-web

Optional web gateway and dashboard for the Carina kernel.

Install alongside `@verlox/carina-core`:

```bash
npm install -g @verlox/carina-core @verlox/carina-web
carina serve
```

Without `@verlox/carina-web`, `carina chat` and other CLI commands work; `carina serve` prints an install hint.

## Exports

- `createWebServer(options)` - Express app for the Carina web gateway
- `startWeb(options)` - create and listen (used by `carina serve` and hosted mode)
- `WEB_ASSET_DIR` - static chat UI assets
- `DASHBOARD_ASSET_DIR` - operator dashboard static files

Peer dependency: `@verlox/carina-core`.
