#!/usr/bin/env bash
# Repo-root wrapper; canonical library is under core docker/scripts (VPS-synced).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
# shellcheck source=../02-backends/core.carinaai.uk/docker/scripts/deploy-lib.sh
source "${REPO_ROOT}/02-backends/core.carinaai.uk/docker/scripts/deploy-lib.sh"
