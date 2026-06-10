import { useAuth } from "@/app/providers/AuthProvider"
import { useEffectiveRole } from "@/shared/hooks/useEffectiveRole"
import { roleLabel, roleRank } from "@/shared/lib/rbac"

// Quiet effective-role indicator (5b, Ted: YES, quiet). Renders in the
// project-scoped header area ONLY when the effective role is LOWER than the
// global claim (a per-project downgrade, e.g. a global producer holding a
// crew member doc). Token colors, muted — no red (red has one job per
// surface and this is not it), border stays 1px.
export function EffectiveRoleChip() {
  const { role: globalRole, loading: authLoading } = useAuth()
  const { role, resolving } = useEffectiveRole()

  if (authLoading || resolving) return null
  if (roleRank(role) >= roleRank(globalRole)) return null

  return (
    <span
      data-testid="effective-role-chip"
      className="inline-flex items-center whitespace-nowrap rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-2xs font-medium text-[var(--color-text-muted)]"
    >
      {roleLabel(role)} on this project
    </span>
  )
}
