#!/usr/bin/env bash
# Install a cron check for the carinaai.uk marketing site on the VPS.
#
# The cron job prints a non-zero failure when the homepage is stale or broken.
# Cron can mail the output to the local user if an MTA is configured.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MARK="# carina-marketing-healthcheck"
MAILTO_VALUE="${MAILTO:-}"

TMP_CRON="$(mktemp)"
trap 'rm -f "${TMP_CRON}"' EXIT

crontab -l 2>/dev/null | grep -v "${MARK}" > "${TMP_CRON}" || true
{
  printf 'CARINA_MARKETING_AUTO_RELOAD=1\n'
  [[ -n "${MAILTO_VALUE}" ]] && printf 'MAILTO=%s\n' "${MAILTO_VALUE}"
  printf '*/10 * * * * cd %s && bash docker/scripts/check-carina-marketing.sh %s\n' "${ROOT_DIR}" "${MARK}"
} >> "${TMP_CRON}"

crontab "${TMP_CRON}"

echo "Installed carina marketing healthcheck cron."
echo "Verify with: crontab -l | grep carina-marketing-healthcheck"
