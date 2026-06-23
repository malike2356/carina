# Sprint 4 - Prompt j/01: PgBouncer Connection Pooling

**Sprint:** 4 - Foundation
**Prompt number:** j/01
**Name:** PgBouncer in transaction mode in front of PostgreSQL; change DATABASE_URL to port 6432
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** sprint-7/infra/01-deploy-scripts.md (server must be provisioned; VPS-SETUP.md exists)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/pending_prompts/sprint-4/j/`.

---

## Read First

1. `infrastructure/VPS-SETUP.md` - append PgBouncer setup procedure here
2. `backends/servers/core.carinaai.uk/.env.example` - DATABASE_URL must be updated to port 6432
3. `infrastructure/ENV-INVENTORY.md` - update DATABASE_URL description

---

## Why PgBouncer

Node.js `pg` opens one TCP connection per pool slot. Without a pooler, a PM2 cluster of 2
Node processes each with a pool of 10 = 20 open PostgreSQL connections. Multiply by staging
and future scale; PostgreSQL starts rejecting connections at the default `max_connections=100`.

PgBouncer in transaction mode sits between the app and PostgreSQL. It holds a small number of
real PostgreSQL connections and multiplexes many app connections over them. The app sees no
difference except a lower-latency connection (Unix socket or 127.0.0.1:6432).

---

## Step 1: Install PgBouncer on the VPS

```bash
apt-get install -y pgbouncer
```

This installs:
- `/etc/pgbouncer/pgbouncer.ini` - main config
- `/etc/pgbouncer/userlist.txt` - credentials file
- `pgbouncer` systemd service

---

## Step 2: Configure PgBouncer

Edit `/etc/pgbouncer/pgbouncer.ini`:

```ini
[databases]
# One entry per database - both production and staging
carina_production = host=127.0.0.1 port=5432 dbname=carina_production
carina_staging = host=127.0.0.1 port=5432 dbname=carina_staging

[pgbouncer]
# Listen on loopback only - no external access
listen_addr = 127.0.0.1
listen_port = 6432

# Transaction mode: connection returned to pool after each transaction
# This is the correct mode for Node.js pg pools
# Do NOT use session mode (wastes connections) or statement mode (breaks transactions)
pool_mode = transaction

# One pool per user+database pair
# max_client_conn: maximum app connections PgBouncer accepts (across all pools)
max_client_conn = 200

# default_pool_size: real PostgreSQL connections per user+database pair
# Keep this at 20; with two databases that is 40 real PG connections total
default_pool_size = 20

# Reserve for admin queries and connection spikes
reserve_pool_size = 5
reserve_pool_timeout = 5

# auth_type: md5 (PostgreSQL default); use scram-sha-256 if PG is configured for it
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Admin access for monitoring
admin_users = pgbouncer_admin
stats_users = pgbouncer_admin

# Log connections and disconnections (verbose; turn off if logs fill up)
log_connections = 0
log_disconnections = 0

# Connection timeout
server_connect_timeout = 15
server_idle_timeout = 600
client_idle_timeout = 300

# PgBouncer user (not the same as postgres superuser)
unix_socket_dir = /var/run/postgresql
```

---

## Step 3: Set up userlist.txt

PgBouncer authenticates clients against `userlist.txt`. It stores md5 hashes of passwords.

Generate the md5 hash for the database user:
```bash
# Format: md5 of (password + username), prefixed with 'md5'
echo -n "md5$(echo -n '<PASSWORD><DB_USER>' | md5sum | cut -d' ' -f1)"
```

Add to `/etc/pgbouncer/userlist.txt`:
```
"<DB_USER>" "md5<HASH>"
"pgbouncer_admin" "md5<ADMIN_HASH>"
```

Permissions:
```bash
chown postgres:postgres /etc/pgbouncer/userlist.txt
chmod 640 /etc/pgbouncer/userlist.txt
```

---

## Step 4: Enable and start PgBouncer

```bash
systemctl enable pgbouncer
systemctl start pgbouncer
systemctl status pgbouncer
```

Verify it is listening:
```bash
ss -tlnp | grep 6432
# Should show: 127.0.0.1:6432
```

Test a connection through PgBouncer:
```bash
psql -h 127.0.0.1 -p 6432 -U <DB_USER> -d carina_production -c "SELECT current_database();"
```

---

## Step 5: Update DATABASE_URL to use PgBouncer port

In `/var/www/[domain]/shared/.env` for all apps (both production and staging):

```env
# Change port from 5432 to 6432 (PgBouncer)
DATABASE_URL=postgresql://<user>:<pass>@127.0.0.1:6432/carina_production

# Staging:
DATABASE_URL=postgresql://<user>:<pass>@127.0.0.1:6432/carina_staging
```

Update `.env.example` in the codebase:
```env
# PgBouncer (transaction pooler) sits on port 6432; PostgreSQL is on 5432
# Always use 6432 in production and staging deployments
DATABASE_URL=postgresql://user:pass@127.0.0.1:6432/carina_production
```

---

## Step 6: Incompatibilities to document and fix

Transaction mode breaks a small number of PostgreSQL features. Audit the codebase and fix or
document each:

**1. LISTEN/NOTIFY** - Not supported in transaction mode.

Grep for `LISTEN` or `pg_notify` in the codebase:
```bash
grep -r 'LISTEN\|pg_notify\|client\.query.*LISTEN' backends/
```

If found: route any LISTEN/NOTIFY calls through a separate `pg.Client` (not a Pool) that
connects directly to PostgreSQL on port 5432, bypassing PgBouncer. Document this with a comment
next to the client creation.

**2. Advisory locks** - `pg_advisory_lock()`, `pg_try_advisory_lock()` - not safe in
transaction mode because PgBouncer may route the lock acquisition and the lock release to
different PostgreSQL connections.

Grep:
```bash
grep -r 'advisory_lock\|pg_advisory' backends/
```

If found: remove advisory locks or replace with a table-based locking pattern (INSERT ... ON CONFLICT).

**3. SET/RESET session-level settings** - `SET search_path`, `SET TIME ZONE`, etc. - reset
when the connection is returned to the pool. These must be moved to the connection string or
to a `per-connection-setup.sql` parameter in pgbouncer.ini if absolutely required.

Grep:
```bash
grep -rE "\.query\(['\"]SET " backends/
```

If found: document and fix each case.

**4. Prepared statements** - PgBouncer in transaction mode drops prepared statements when the
connection is returned to the pool. Most Node.js pg usage does not use named prepared
statements explicitly, but check if `pg.query()` calls use the `{ name, text, values }` form.

Grep:
```bash
grep -r '"name":\|name:.*text:.*values:' backends/
```

If found: remove the `name` field to use anonymous prepared statements (one-off, not cached).

Document all findings in `infrastructure/VPS-SETUP.md` under a "PgBouncer incompatibilities" section.

---

## Step 7: Monitoring PgBouncer

Connect to the PgBouncer admin console:
```bash
psql -h 127.0.0.1 -p 6432 -U pgbouncer_admin pgbouncer
```

Useful commands in the admin console:
```sql
SHOW POOLS;       -- active, waiting, idle connections per pool
SHOW CLIENTS;     -- connected clients
SHOW SERVERS;     -- real PostgreSQL connections
SHOW STATS;       -- requests per second, average wait time
SHOW CONFIG;      -- current config
RELOAD;           -- reload config after changes (no restart needed)
```

Add a health check to `GET /health` in core backend:

```typescript
// In the health endpoint, add a PgBouncer pool check:
// Query SHOW POOLS via the admin connection and return pool stats
// or simply: run the existing DB health check (which goes through PgBouncer)
// If the DB query succeeds, PgBouncer is working
```

---

## Step 8: Reload on config change

After any change to `pgbouncer.ini` or `userlist.txt`, do NOT restart PgBouncer (that drops
all connections). Use RELOAD instead:

```bash
# Via systemd
systemctl reload pgbouncer

# Or via admin console
psql -h 127.0.0.1 -p 6432 -U pgbouncer_admin pgbouncer -c "RELOAD;"
```

Document this in `infrastructure/VPS-SETUP.md`.

---

## Step 9: Document in VPS-SETUP.md

Append to `infrastructure/VPS-SETUP.md`:

```markdown
## PgBouncer connection pooler

PgBouncer runs on 127.0.0.1:6432 in transaction mode.
PostgreSQL is on 127.0.0.1:5432 (not exposed externally).
All apps connect through PgBouncer (DATABASE_URL uses port 6432).

Databases in pool:
- carina_production (port 6432)
- carina_staging (port 6432)

Pool size: 20 real PostgreSQL connections per database.
Max client connections: 200.

Admin access:
  psql -h 127.0.0.1 -p 6432 -U pgbouncer_admin pgbouncer

Monitor:
  SHOW POOLS;
  SHOW STATS;

Reload config (no restart):
  systemctl reload pgbouncer

Incompatibilities (transaction mode):
- LISTEN/NOTIFY: use a direct pg.Client on port 5432
- Advisory locks: not supported; use table-based locks instead
- SET session-level: not preserved across transactions
- Named prepared statements: remove the name field; use anonymous queries

To add a new database:
  1. Add entry under [databases] in /etc/pgbouncer/pgbouncer.ini
  2. Reload: systemctl reload pgbouncer
```

---

## Done When

- [ ] PgBouncer installed via apt-get
- [ ] `/etc/pgbouncer/pgbouncer.ini` configured with both databases, port 6432, transaction mode, pool_size=20
- [ ] `/etc/pgbouncer/userlist.txt` contains the database user with correct md5 hash
- [ ] PgBouncer service enabled and running (`systemctl status pgbouncer` = active)
- [ ] `ss -tlnp | grep 6432` shows PgBouncer listening on 127.0.0.1 only
- [ ] `psql -h 127.0.0.1 -p 6432 -U <user> carina_production` connects successfully
- [ ] All `shared/.env` files updated to use port 6432
- [ ] `.env.example` in the repo updated to show port 6432 with a comment
- [ ] Codebase audited for LISTEN/NOTIFY, advisory locks, SET session, named prepared statements
- [ ] Any incompatibilities found are fixed or documented
- [ ] `SHOW POOLS;` in the admin console shows active connections after apps are restarted
- [ ] `infrastructure/VPS-SETUP.md` includes PgBouncer section with reload procedure and incompatibility notes
- [ ] No em dashes in documentation
