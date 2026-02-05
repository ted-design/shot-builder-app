import { Button } from "@/ui/button"
import { ChevronUp, ChevronDown } from "lucide-react"
import { persistShotOrder } from "@/features/shots/lib/reorderShots"
import { useAuth } from "@/app/providers/AuthProvider"
import { toast } from "sonner"
import type { Shot } from "@/shared/types"

interface ShotReorderControlsProps {
  readonly shot: Shot
  readonly shots: ReadonlyArray<Shot>
  readonly index: number
  readonly onOptimisticReorder: (reordered: ReadonlyArray<Shot>) => void
  readonly onReorderComplete: () => void
}

export function ShotReorderControls({
  shot,
  shots,
  index,
  onOptimisticReorder,
  onReorderComplete,
}: ShotReorderControlsProps) {
  const { clientId } = useAuth()
  const isFirst = index === 0
  const isLast = index === shots.length - 1

  const move = async (direction: -1 | 1) => {
    if (!clientId) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= shots.length) return

    const reordered = [...shots]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved!)

    onOptimisticReorder(reordered)

    try {
      await persistShotOrder(reordered, clientId)
      onReorderComplete()
    } catch {
      onReorderComplete()
      toast.error("Failed to save shot order. Reverting.")
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={isFirst}
        onClick={(e) => {
          e.stopPropagation()
          move(-1)
        }}
      >
        <ChevronUp className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        disabled={isLast}
        onClick={(e) => {
          e.stopPropagation()
          move(1)
        }}
      >
        <ChevronDown className="h-3 w-3" />
      </Button>
    </div>
  )
}
