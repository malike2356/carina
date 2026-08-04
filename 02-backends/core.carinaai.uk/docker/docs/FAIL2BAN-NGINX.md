# Fail2ban jails for Carina nginx (host or Docker nginx logs)

Mount nginx access logs to the host or tail the `nginx` container logs, then enable these jails in `/etc/fail2ban/jail.local`.

```ini
[nginx-auth]
enabled = true
filter = nginx-auth
logpath = /var/log/nginx/access.log
maxretry = 5
findtime = 600
bantime = 3600

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 2
findtime = 600
bantime = 86400
```

Filter snippets live in `docker/nginx/fail2ban/`:

- `nginx-auth.conf`: matches 401/403 on `/api/auth/` and `/login`
- `nginx-botsearch.conf`: matches common scanner paths

After editing:

```bash
sudo fail2ban-client reload
sudo fail2ban-client status nginx-auth
```

Pair with `docker/scripts/vps-hardening.sh` (ufw allow 22,80,443 only).
