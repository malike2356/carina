#!/usr/bin/env bash
set -euo pipefail

# Smoke test: unrelated compose projects stay hidden from the scoped ops view.
# Usage:
#   OPS_DOCKER_PROJECTS=corecarinaaiuk,scout ./scripts/smoke-docker-scope.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPS_DIR="$ROOT/../../admin/ops.carinaai.uk"

if [[ ! -d "$OPS_DIR" ]]; then
  echo "ERROR: ops panel not found at $OPS_DIR" >&2
  exit 1
fi

export OPS_DOCKER_PROJECTS="${OPS_DOCKER_PROJECTS:-corecarinaaiuk,scout}"
export CARINA_WHITE_LABEL_STACK="${CARINA_WHITE_LABEL_STACK:-}"

echo "[smoke] OPS_DOCKER_PROJECTS=$OPS_DOCKER_PROJECTS"
cd "$OPS_DIR"
pnpm exec vitest run lib/server-services.test.ts
