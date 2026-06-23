#!/usr/bin/env bash
set -euo pipefail

# Render nginx server blocks for verified Carina Cloud custom domains.
# Usage:
#   CARINA_CUSTOM_DOMAINS="workspace.client.example,portal.partner.example" \
#     ./docker/scripts/render-custom-domain-nginx.sh > /tmp/carina-cloud-custom-domains.conf

TEMPLATE_DIR="$(cd "$(dirname "$0")/../nginx" && pwd)"
DOMAINS="${CARINA_CUSTOM_DOMAINS:-}"

if [[ -z "$DOMAINS" ]]; then
  echo "# No CARINA_CUSTOM_DOMAINS configured." >&2
  exit 0
fi

IFS=',' read -ra HOSTS <<< "$DOMAINS"
for host in "${HOSTS[@]}"; do
  trimmed="$(echo "$host" | xargs)"
  [[ -z "$trimmed" ]] && continue
  sed "s/CUSTOMER_HOSTNAME/${trimmed}/g" "$TEMPLATE_DIR/carina-cloud-custom-domains.inc.example"
  echo ""
done
