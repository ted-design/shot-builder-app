#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# safe-switch.sh — Safe branch switching with stash
#
# Usage:
#   bash scripts/safe-switch.sh <branch-name>
# ──────────────────────────────────────────────

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/safe-switch.sh <branch-name>"
  exit 1
fi

TARGET_BRANCH="$1"
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)

# Check if target branch exists
if ! git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH" 2>/dev/null && \
   ! git show-ref --verify --quiet "refs/remotes/origin/$TARGET_BRANCH" 2>/dev/null; then
  echo ""
  echo "WARNING: Branch '$TARGET_BRANCH' does not exist locally or on origin."
  echo "  To create it:  git checkout -b $TARGET_BRANCH"
  echo ""
  exit 1
fi

# Check for uncommitted changes (staged + unstaged + untracked)
status_output=$(git status --porcelain)

if [ -n "$status_output" ]; then
  echo ""
  echo "Uncommitted changes detected on '$CURRENT_BRANCH':"
  echo ""
  git status --short
  echo ""

  read -rp "Stash changes (including untracked) before switching? [y/N] " answer

  case "$answer" in
    [yY]|[yY][eE][sS])
      stash_msg="safe-switch: auto-stash from $CURRENT_BRANCH → $TARGET_BRANCH"
      git stash push -u -m "$stash_msg"
      echo ""
      echo "Changes stashed. To restore later:"
      echo "  git stash pop"
      echo "  git stash list  (to see all stashes)"
      echo ""
      ;;
    *)
      echo ""
      echo "Aborted — branch not switched. Commit or stash your changes first."
      echo ""
      exit 1
      ;;
  esac
fi

git checkout "$TARGET_BRANCH"
echo ""
echo "Switched to '$TARGET_BRANCH'."
echo ""
