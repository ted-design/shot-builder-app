import type { ShareLink } from "@/features/links/lib/shareLinkTypes"

interface ShareLinkStatsProps {
  readonly links: readonly ShareLink[]
}

export function ShareLinkStats({ links }: ShareLinkStatsProps) {
  let active = 0
  let disabled = 0
  let expired = 0

  for (const link of links) {
    if (link.status === "active") active++
    else if (link.status === "disabled") disabled++
    else if (link.status === "expired") expired++
  }

  const parts: string[] = []
  if (active > 0) parts.push(`${active} active`)
  if (disabled > 0) parts.push(`${disabled} disabled`)
  if (expired > 0) parts.push(`${expired} expired`)

  if (parts.length === 0) return null

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
      {active > 0 && (
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-status-green-text)]"
            aria-hidden="true"
          />
          {active} active
        </span>
      )}
      {disabled > 0 && (
        <span className="flex items-center gap-1">
          {active > 0 && <span className="text-[var(--color-text-subtle)]" aria-hidden="true">·</span>}
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-status-gray-text)]"
            aria-hidden="true"
          />
          {disabled} disabled
        </span>
      )}
      {expired > 0 && (
        <span className="flex items-center gap-1">
          {(active > 0 || disabled > 0) && (
            <span className="text-[var(--color-text-subtle)]" aria-hidden="true">·</span>
          )}
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-status-red-text)]"
            aria-hidden="true"
          />
          {expired} expired
        </span>
      )}
    </div>
  )
}
