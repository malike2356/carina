#!/usr/bin/env bash
# Install /etc/logrotate.d/verlox for backup and ops logs (run once on VPS with sudo).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="/etc/logrotate.d/verlox"

sudo tee "${TARGET}" > /dev/null <<'EOF'
/var/log/verlox/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
}
EOF

echo "Installed ${TARGET}"
echo "Test: sudo logrotate -d ${TARGET}"
