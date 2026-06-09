# Fix Runaway PHP Process on VPS

A Laravel `artisan config:cache` command is stuck running at 99% CPU for
3+ days, consuming 6.8 GB RAM (55% of the VPS total). Kill it, investigate
the cause, and prevent recurrence.

## VPS connection

SSH: `ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519`
Host alias: `aman` (defined in ~/.ssh/config)
User: malike (NO sudo password)

## Steps; do ALL of them, don't stop after step 1

### Step 1: Verify the problem

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'ps aux | grep "config:cache" | grep -v grep'
```

Expected: one PHP process at 99% CPU, 50%+ MEM, running since Jun 06.
If PID is different from 1507570, note the actual PID.

### Step 2: Kill it

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'kill -9 1507570'
```

(If PID differs from step 1, use that PID instead.)

### Step 3: Verify it's dead

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'ps aux | grep "config:cache" | grep -v grep; echo "Exit code: $?"'
```

Should return empty output and exit code 1 (no match found = dead).

### Step 4: Check resources after kill

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'free -h && echo "---" && uptime'
```

Load average should drop. Available memory should jump significantly.

### Step 5: Check bootstrap/cache for corruption

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'ls -la /www/wwwroot/propreneur-v2/bootstrap/cache/ 2>/dev/null'
```

Look for: stale lock files, zero-byte files, files owned by wrong user,
read-only permissions.

### Step 6: Check Laravel logs for clues

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'tail -200 /www/wwwroot/propreneur-v2/storage/logs/laravel.log 2>/dev/null | grep -i -A5 "config\|cache\|error\|timeout\|memory\|killed\|signal" | head -80'
```

### Step 7: Clean up and prevent recurrence

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'rm -f /www/wwwroot/propreneur-v2/bootstrap/cache/*.php && echo "Cache files removed"'
```

Then try a quick config:clear (with timeout; 30 seconds max):

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'cd /www/wwwroot/propreneur-v2 && timeout 30 php artisan config:clear 2>&1 || echo "Timed out or failed; skipping"'
```

Do NOT run `artisan config:cache`. That's what got stuck. Use `config:clear`.

### Step 8: Verify Carina services are still healthy

```bash
ssh malike@80.190.81.208 -i ~/.ssh/id_ed25519 \
  'sudo supervisorctl status carina-core labyrinth-scout carina-ops'
```

All three should say RUNNING.

### Step 9: Final report

Print a summary:
- What process was killed (PID, command, how long it ran)
- How much memory was freed
- Current load average
- What was likely wrong with bootstrap/cache
- Whether Carina services are healthy
- Whether config:clear succeeded

## Safety rules

- DO use: kill -9, rm specific .php files, supervisorctl status
- Do NOT use: rm -rf, find -delete, pkill, killall
- Do NOT restart nginx, supervisor, or any running services
- Do NOT run database migrations
- Do NOT run artisan optimize or artisan config:cache
