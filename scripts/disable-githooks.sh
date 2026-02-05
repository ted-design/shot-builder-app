#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# disable-githooks.sh — Revert core.hooksPath to default (repo-local)
# ──────────────────────────────────────────────

git config --local --unset core.hooksPath 2>/dev/null || true
echo "Git hooks disabled: core.hooksPath reverted to default."
echo "  To re-enable: bash scripts/enable-githooks.sh"
