#!/usr/bin/env bash
# Deploy Carina staging (repo-root wrapper).
exec "$(cd "$(dirname "$0")/.." && pwd)/02-backends/core.carinaai.uk/docker/scripts/deploy-staging.sh" "$@"
