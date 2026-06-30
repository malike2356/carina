#!/bin/sh
set -eu

PASSWORD="${REDIS_PASSWORD:-dev-redis-local}"

exec redis-server \
  --requirepass "$PASSWORD" \
  --protected-mode yes \
  --rename-command FLUSHALL "" \
  --rename-command FLUSHDB "" \
  --rename-command CONFIG "CONFIG_DISABLED_USE_ENV" \
  --rename-command DEBUG "" \
  --rename-command SHUTDOWN "" \
  --loglevel warning \
  --maxmemory 512mb \
  --maxmemory-policy allkeys-lru
