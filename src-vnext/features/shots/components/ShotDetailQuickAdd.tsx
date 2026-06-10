import { toast } from "sonner"
import { useShots } from "@/features/shots/hooks/useShots"
import { ShotQuickAdd } from "@/features/shots/components/ShotQuickAdd"
import { SectionLabel } from "@/features/shots/components/ShotDetailShared"

// In-editor quick-add (bottom of the right rail). Mounted only for
// canDoOperational roles, so the project shots subscription — needed for
// next-shot-number computation, same query the list page holds — never
// starts for read-only viewers. Created shots append to the end of the
// project list; the user stays on the current shot (Ted 2026-06-10).
export function ShotDetailQuickAdd() {
  const { data: shots, loading } = useShots()

  // Numbering needs the loaded list — creating against an empty snapshot
  // would mint duplicate shot numbers.
  if (loading) return null

  return (
    <div data-testid="shot-detail-quick-add">
      <SectionLabel>Quick add</SectionLabel>
      <div className="mt-1.5">
        <ShotQuickAdd
          shots={shots}
          onCreated={(_shotId, title) => {
            toast.success("Shot created", { description: title })
          }}
        />
      </div>
    </div>
  )
}
