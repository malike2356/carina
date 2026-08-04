#!/bin/bash
# One-time / recovery: copy core proxy + platform keys into VPS secrets file (outside deploy dir).
# Run from app.carinaai.uk/: bash scripts/ensure-vps-secrets.sh

set -euo pipefail

VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
CORE_ENV="/home/malike/apps/core.carinaai.uk/.env"
SECRETS="/home/malike/secrets/app.carinaai.uk.env"

ssh "${VPS_USER}@${VPS_HOST}" bash << REMOTE
set -euo pipefail
mkdir -p /home/malike/secrets
chmod 700 /home/malike/secrets
{
  echo "# Carina Cloud secrets (outside deploy dir; not touched by rsync)"
  for key in CARINA_OPS_TOKEN CARINA_INTERNAL_KEY OPENAI_API_KEY DEEPSEEK_API_KEY GROQ_API_KEY; do
    line=\$(grep "^\${key}=" "${CORE_ENV}" 2>/dev/null | head -1 || true)
    if [[ -n "\${line}" ]]; then
      echo "\${line}"
    fi
  done
} > "${SECRETS}"
chmod 600 "${SECRETS}"
echo "Wrote keys to ${SECRETS}:"
cut -d= -f1 "${SECRETS}" | grep -v '^#'
REMOTE

echo "Done. Restart: ssh ${VPS_USER}@${VPS_HOST} 'sudo supervisorctl restart carina-cloud'"
