#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STACK="${CARINA_WHITE_LABEL_STACK:-}"
if [[ -z "$STACK" ]]; then
  echo "ERROR: set CARINA_WHITE_LABEL_STACK (example: export CARINA_WHITE_LABEL_STACK=acme-agents)" >&2
  exit 1
fi

ENV_FILE="${CARINA_WHITE_LABEL_ENV_FILE:-.env.white-label.${STACK}}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export CARINA_WHITE_LABEL_STACK="$STACK"
export COMPOSE_PROJECT_NAME="$STACK"
export OPS_DOCKER_PROJECTS="${OPS_DOCKER_PROJECTS:-$STACK}"

COMPOSE=(docker compose -f docker-compose.prod.yml -f docker-compose.white-label.yml)

echo "[white-label] stack=$STACK project=$COMPOSE_PROJECT_NAME"
echo "[white-label] networks: ${STACK}_net, ${STACK}_carina"
echo "[white-label] ops scope: OPS_DOCKER_PROJECTS=$OPS_DOCKER_PROJECTS"

exec "${COMPOSE[@]}" "$@"
