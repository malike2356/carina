#!/usr/bin/env bash
# Sourced by deploy-to-production.sh - do not run directly.

deploy_git_check() {
  local branch="${1:-main}"
  local allow_dirty="${2:-0}"
  local skip_check="${3:-0}"

  if [[ "$skip_check" == "1" ]] || [[ ! -d .git ]]; then
    return 0
  fi

  if [[ "$allow_dirty" != "1" ]] && [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: Uncommitted changes in $(pwd)." >&2
    echo "       Commit and push to GitHub first, or re-run with --allow-dirty (not recommended)." >&2
    return 1
  fi

  if ! git remote get-url origin &>/dev/null; then
    echo "WARN: No git remote 'origin' - cannot verify push mirror." >&2
    return 0
  fi

  git fetch origin "$branch" --quiet 2>/dev/null || {
    echo "WARN: Could not fetch origin/$branch - skipping push/pull parity check." >&2
    return 0
  }

  local local_sha remote_sha
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse "origin/$branch" 2>/dev/null || true)"

  if [[ -z "$remote_sha" ]]; then
    echo "WARN: origin/$branch not found - push your branch to GitHub before deploy." >&2
    return 0
  fi

  if [[ "$local_sha" == "$remote_sha" ]]; then
    echo "==> Git mirror OK: HEAD matches origin/$branch ($(git rev-parse --short HEAD))"
    return 0
  fi

  if git merge-base --is-ancestor "$local_sha" "$remote_sha" 2>/dev/null; then
    echo "ERROR: Local is behind origin/$branch. Run: git pull origin $branch" >&2
    return 1
  fi

  if git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
    echo "ERROR: Local has commits not on GitHub. Run: git push origin $branch" >&2
    echo "       Deploy only after GitHub and local are the same commit." >&2
    return 1
  fi

  echo "ERROR: Local and origin/$branch have diverged. Reconcile before deploy." >&2
  return 1
}

deploy_git_short_sha() {
  if [[ -d .git ]]; then
    git rev-parse --short HEAD 2>/dev/null || echo "unknown"
  else
    echo "no-git"
  fi
}

deploy_git_full_sha() {
  if [[ -d .git ]]; then
    git rev-parse HEAD 2>/dev/null || echo "unknown"
  else
    echo "no-git"
  fi
}

deploy_git_branch() {
  if [[ -d .git ]]; then
    git branch --show-current 2>/dev/null || echo "unknown"
  else
    echo "no-git"
  fi
}
