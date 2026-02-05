#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# enable-githooks.sh — Point core.hooksPath to .githooks (repo-local)
# ──────────────────────────────────────────────

git config --local core.hooksPath .githooks
echo "Git hooks enabled: core.hooksPath set to .githooks"
echo "  Hooks: pre-commit, pre-push"
echo "  To disable: bash scripts/disable-githooks.sh"
