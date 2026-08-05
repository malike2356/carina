#!/usr/bin/env bash
# Install the Carina marketing site healthcheck on the VPS.
#
# Usage:
#   bash docker/scripts/install-marketing-healthcheck.sh cron
#   bash docker/scripts/install-marketing-healthcheck.sh systemd
#
# Default mode is cron. The systemd mode installs the unit files into the user
# systemd directory, enables the timer, and starts it immediately.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODE="${1:-cron}"

install_cron() {
  bash "${ROOT_DIR}/docker/scripts/setup-marketing-healthcheck-cron.sh"
}

install_systemd() {
  local user_systemd_dir="${HOME}/.config/systemd/user"
  mkdir -p "${user_systemd_dir}"
  install -m 0644 "${ROOT_DIR}/docker/systemd/carinaai-marketing-healthcheck.service" \
    "${user_systemd_dir}/carinaai-marketing-healthcheck.service"
  install -m 0644 "${ROOT_DIR}/docker/systemd/carinaai-marketing-healthcheck.timer" \
    "${user_systemd_dir}/carinaai-marketing-healthcheck.timer"
  systemctl --user daemon-reload
  systemctl --user enable --now carinaai-marketing-healthcheck.timer
  echo "Installed and started carinaai-marketing-healthcheck.timer"
  systemctl --user status --no-pager carinaai-marketing-healthcheck.timer || true
}

case "${MODE}" in
  cron)
    install_cron
    ;;
  systemd)
    install_systemd
    ;;
  *)
    echo "Usage: bash docker/scripts/install-marketing-healthcheck.sh [cron|systemd]" >&2
    exit 1
    ;;
esac
