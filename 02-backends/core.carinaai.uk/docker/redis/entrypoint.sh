#!/bin/sh
set -eu

if [ -z "${REDIS_PASSWORD:-}" ]; then
  echo "REDIS_PASSWORD is required" >&2
  exit 1
fi

ACL_FILE=/tmp/users.acl
cat > "$ACL_FILE" <<EOF
user default off nopass ~* &* -@all
user carina on >${REDIS_PASSWORD} ~carina:* ~labyrinth:* ~session:* ~cache:* ~scout:* &labyrinth:control +@read +@write +@pubsub +@connection -@dangerous -@admin
EOF

exec redis-server \
  --aclfile "$ACL_FILE" \
  --protected-mode yes \
  --rename-command FLUSHALL "" \
  --rename-command FLUSHDB "" \
  --rename-command CONFIG "CONFIG_DISABLED_USE_ENV" \
  --rename-command DEBUG "" \
  --rename-command SHUTDOWN "" \
  --loglevel warning \
  --maxmemory 512mb \
  --maxmemory-policy allkeys-lru
