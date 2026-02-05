#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# safe-commit.sh — Safe commit wrapper
#
# Usage:
#   bash scripts/safe-commit.sh "commit message"
#   bash scripts/safe-commit.sh --no-verify "commit message"
#   bash scripts/safe-commit.sh              # opens $EDITOR
# ──────────────────────────────────────────────

PROTECTED_BRANCHES="^(main|master)$"
SKIP_VERIFY=false
COMMIT_MSG=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-verify)
      SKIP_VERIFY=true
      shift
      ;;
    *)
      COMMIT_MSG="$1"
      shift
      ;;
  esac
done

# ── 1. Branch check ──────────────────────────
branch=$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD)

if echo "$branch" | grep -qE "$PROTECTED_BRANCHES"; then
  echo ""
  echo "ERROR: You are on the protected branch '$branch'."
  echo "  Create a feature branch first:  git checkout -b vnext/your-feature"
  echo ""
  exit 1
fi

# ── 2. Merge conflict check ─────────────────
if [ -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]; then
  echo ""
  echo "ERROR: Unresolved merge detected (.git/MERGE_HEAD exists)."
  echo "  Resolve the merge first, then stage and commit."
  echo "  To abort the merge:  git merge --abort"
  echo ""
  exit 1
fi

# Check staged files for conflict markers
staged_files=$(git diff --cached --name-only --diff-filter=ACMR)
if [ -n "$staged_files" ]; then
  conflict_found=0
  for file in $staged_files; do
    staged_content=$(git show ":$file" 2>/dev/null || true)
    if [ -n "$staged_content" ]; then
      if echo "$staged_content" | grep -qE '^<{7} |^={7}$|^>{7} '; then
        echo "ERROR: Conflict marker found in staged file: $file"
        conflict_found=1
      fi
    fi
  done
  if [ "$conflict_found" -eq 1 ]; then
    echo ""
    echo "Commit aborted — resolve conflict markers, re-stage, and try again."
    echo ""
    exit 1
  fi
fi

# ── 3. Summary ───────────────────────────────
echo ""
echo "Branch:  $branch"
echo ""

staged_count=$(git diff --cached --name-only | wc -l | tr -d ' ')
unstaged_count=$(git diff --name-only | wc -l | tr -d ' ')
untracked_count=$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')

echo "Staged files:    $staged_count"
echo "Unstaged files:  $unstaged_count"
echo "Untracked files: $untracked_count"
echo ""

if [ "$staged_count" -eq 0 ]; then
  echo "WARNING: Nothing is staged. Stage files first with 'git add <files>'."
  echo ""
  exit 1
fi

git diff --cached --stat
echo ""

# ── 4. Quality checks (unless --no-verify) ──
if [ "$SKIP_VERIFY" = false ]; then
  echo "Running quality checks..."
  echo ""

  echo "→ TypeScript type check..."
  npx tsc --noEmit || { echo "TypeScript check failed. Fix errors and retry."; exit 1; }
  echo ""

  echo "→ Lint..."
  npm run lint || { echo "Lint failed. Fix errors and retry."; exit 1; }
  echo ""

  echo "→ Tests..."
  npm test || { echo "Tests failed. Fix errors and retry."; exit 1; }
  echo ""

  echo "→ Build..."
  npm run build || { echo "Build failed. Fix errors and retry."; exit 1; }
  echo ""

  echo "All checks passed."
  echo ""
fi

# ── 5. Commit ────────────────────────────────
if [ -n "$COMMIT_MSG" ]; then
  git commit -m "$COMMIT_MSG"
else
  git commit
fi

echo ""
echo "Committed successfully on '$branch'."
echo ""
echo "Next steps:"
echo "  git push -u origin HEAD"
echo "  Then open a Pull Request on GitHub."
echo ""
