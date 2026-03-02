import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import type { TalentRecord } from "@/shared/types"
import { buildDisplayName, initials } from "@/features/library/components/talentUtils"

export function HeadshotThumb({ talent }: { readonly talent: TalentRecord }) {
  const path = talent.headshotPath || talent.imageUrl || undefined
  const url = useStorageUrl(path)
  const name = buildDisplayName(talent)
  return (
    <div className="h-14 w-14 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--color-text-muted)]">
          {initials(name)}
        </div>
      )}
    </div>
  )
}
