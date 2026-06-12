import { Eye } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useViewAsPreview } from "@/app/providers/ViewAsPreviewProvider"
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
  // 5e-III View-as: the in-memory preview role (null = not previewing).
  const { previewRole } = useViewAsPreview()

  // 5e-III: an active preview always renders its own "Previewing as X" chip,
  // ahead of BOTH the auth/role loading guards and the downgrade pill below: a
  // preview is only ever set by deliberate action, so if a claim refresh briefly
  // re-enters `resolving` the previewer must still see they're in a narrowed
  // view, not a blank. (The downgrade-rank guard below would also miss it.)
  if (previewRole !== null) {
    return (
      <span
        data-testid="view-as-previewing-chip"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-2xs font-medium text-[var(--color-text-muted)]"
      >
        <Eye className="h-3 w-3" aria-hidden="true" />
        Previewing as {roleLabel(previewRole)}
      </span>
    )
  }

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
