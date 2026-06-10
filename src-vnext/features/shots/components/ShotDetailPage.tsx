import { ShotDetailPageUnified } from "@/features/shots/components/ShotDetailPageUnified"

// Phase 5c: the unified two-column editor is the only shot detail surface.
// The featureUnifiedShotEditor flag and the legacy (ThreePanel-era) detail
// body were retired with the flag removal.
export default function ShotDetailPage() {
  return <ShotDetailPageUnified />
}
