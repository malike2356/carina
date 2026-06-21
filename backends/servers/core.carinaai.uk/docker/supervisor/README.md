# Supervisor configs

Two layouts:

- **`container/`** - paths under `/app`, used by `Dockerfile.carina` and supervisord inside Docker
- **`vps/`** - paths under `/home/malike/apps/`, copy to `/etc/supervisor/conf.d/` on the Contabo VPS

Root `supervisord.conf` includes only `container/*.conf`.

Optional programs inside Docker (disabled by default):

| Env var | Program |
|---------|---------|
| `CARINA_SPLIT_GATEWAY=true` | carina-gateway |
| `CARINA_SUPERVISOR_HUB=true` | carina-hub |
| `CARINA_SUPERVISOR_OPS=true` | carina-ops (requires ops bundle at `/app/ops.carinaai.uk`) |

Install on VPS:

```bash
sudo cp docker/supervisor/vps/carina-core.conf /etc/supervisor/conf.d/
sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start carina-core
```

Or use `bash scripts/deploy-carina.sh` from the carina repo root.
