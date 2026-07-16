#!/bin/sh
set -eu

if [ -z "${REDIS_PASSWORD:-}" ]; then
  echo "REDIS_PASSWORD is required" >&2
  exit 1
fi

ACL_FILE=/tmp/users.acl
cat > "$ACL_FILE" <<EOF
user default off nopass ~* &* -@all
user scout on >${REDIS_PASSWORD} ~scout:* ~labyrinth:* ~session:* ~cache:* &scout:* &labyrinth:control +@read +@write +@pubsub +@connection +info -@dangerous -@admin
EOF

exec redis-server \
  --aclfile "$ACL_FILE" \
  --protected-mode no \
  --rename-command FLUSHALL "" \
  --rename-command FLUSHDB "" \
  --rename-command CONFIG "CONFIG_DISABLED_USE_ENV" \
  --rename-command DEBUG "" \
  --rename-command SHUTDOWN "" \
  --loglevel warning \
  --maxmemory 256mb \
  --maxmemory-policy allkeys-lru
