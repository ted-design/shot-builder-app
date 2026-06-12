// Right rail of the unified shot editor — sticky at xl, hosts Looks + Products.
import { ShotLooksSection } from "@/features/shots/components/ShotLooksSection"
import { SectionLabel } from "@/features/shots/components/ShotDetailShared"
import type { Shot } from "@/shared/types"

interface ShotDetailSidebarProps {
  readonly shot: Shot
  /** Required capability gate for look/product writes in the rail. */
  readonly canEditLooks: boolean
}

export function ShotDetailSidebar({ shot, canEditLooks }: ShotDetailSidebarProps) {
  return (
    <div
      className="flex flex-col gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
      data-testid="shot-detail-sidebar"
    >
      <SectionLabel>Looks + Products</SectionLabel>
      <ShotLooksSection
        shot={shot}
        canEdit={canEditLooks}
        showReferencesSection={false}
      />
    </div>
  )
}
