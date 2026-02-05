# Git Guardrails

Local safety nets for the Shot Builder vNext repository. These hooks and scripts reduce the risk of accidental data loss or pushes to protected branches.

> **Advisory:** Local hooks can be bypassed with `--no-verify`. Real enforcement requires GitHub branch protection rules (require PRs, disallow force push, required status checks). These guardrails are a development aid, not a security boundary.

## Branch Policy

| Branch | Policy |
|--------|--------|
| `main` / `master` | Protected. No direct commits or pushes. All changes via PR. |
| `vnext/*` | Active development branches. One slice per branch. |

## Safe Workflow

```
1. git checkout -b vnext/your-feature     # Create feature branch
2. git add <files>                         # Stage specific files
3. bash scripts/safe-commit.sh "message"   # Commit with checks
4. git push -u origin HEAD                 # Push branch
5. Open a Pull Request on GitHub           # Merge via PR
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/safe-commit.sh "msg"` | Branch guard + conflict check + tsc/lint/test/build + commit |
| `scripts/safe-commit.sh --no-verify "msg"` | Same but skips quality checks |
| `scripts/safe-switch.sh <branch>` | Stash dirty tree (incl. untracked) before switching |
| `scripts/enable-githooks.sh` | Set `core.hooksPath` to `.githooks` |
| `scripts/disable-githooks.sh` | Revert `core.hooksPath` to default |

## Hooks (`.githooks/`)

| Hook | What it blocks |
|------|----------------|
| `pre-commit` | Commits on main/master, unresolved merges, conflict markers in staged files |
| `pre-push` | Pushes from main/master, pushes targeting main/master refs |

### Enable hooks

```bash
bash scripts/enable-githooks.sh
```

### Disable hooks

```bash
bash scripts/disable-githooks.sh
```

## Never-Do List

These commands are destructive and should not be used without careful consideration:

| Command | Risk |
|---------|------|
| `git reset --hard` | Destroys uncommitted work permanently |
| `git clean -fd` | Deletes untracked files permanently |
| `git push --force` (to main) | Rewrites shared history |
| `git checkout .` (with uncommitted work) | Discards all unstaged changes |
| `git merge` directly to main | Bypasses PR review |
| `git branch -D` | Deletes branch without merge check |

## Recovery

If something goes wrong:

| Situation | Recovery |
|-----------|----------|
| Accidentally committed | `git reset --soft HEAD~1` (keeps changes staged) |
| Lost commits | `git reflog` to find and `git cherry-pick` |
| Stashed and forgot | `git stash list` then `git stash pop stash@{N}` |
| Wrong branch | `git stash push -u -m "oops"` then switch and pop |
| Force-pushed (not main) | `git reflog` on the remote-tracking branch |

## Pre-Push / PR Checklist

Before pushing:
- [ ] On a feature branch (not main/master)
- [ ] All changes committed (no dirty tree)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Commit messages follow conventional format
