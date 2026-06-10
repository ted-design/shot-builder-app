// Phase 5a — named right-rail component for the unified shot editor.
//
// Sticky at xl (minmax(340px,400px) column in the page grid), stacks below xl.
// Hosts the Looks + Products workspace; reference uploads are hidden here by
// design (showReferencesSection={false} — uploads live in the hero rail and
// are gated by canUploadShotImages at the page level).
import { ShotLooksSection } from "@/features/shots/components/ShotLooksSection"
import { SectionLabel } from "@/features/shots/components/ShotDetailShared"
import type { Shot } from "@/shared/types"

interface ShotDetailSidebarProps {
  readonly shot: Shot
  /**
   * REQUIRED capability prop (default-deny — no optional/`= true` fallback).
   * Gates all look/product writes in the rail (page canEdit semantics:
   * canManageShots(role) && !isMobile).
   */
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
