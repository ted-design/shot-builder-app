// Right rail of the unified shot editor — sticky at xl, hosts Looks + Products.
import type { ReactNode } from "react"
import { ShotLooksSection } from "@/features/shots/components/ShotLooksSection"
import { SectionLabel } from "@/features/shots/components/ShotDetailShared"
import type { Shot } from "@/shared/types"

interface ShotDetailSidebarProps {
  readonly shot: Shot
  /** Required capability gate for look/product writes in the rail. */
  readonly canEditLooks: boolean
  /** Bottom-of-rail slot (the in-editor quick-add; gated by the page). */
  readonly footer?: ReactNode
}

export function ShotDetailSidebar({ shot, canEditLooks, footer }: ShotDetailSidebarProps) {
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
      {footer}
    </div>
  )
}
