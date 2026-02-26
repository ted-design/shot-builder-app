import { Check, X, RefreshCw } from "lucide-react"
import { Button } from "@/ui/button"

export type PickOutcome = "picked" | "not_available" | "substitute"

interface WarehousePickOutcomeBarProps {
  readonly onOutcome: (outcome: PickOutcome) => void
  readonly disabled?: boolean
}

export function WarehousePickOutcomeBar({
  onOutcome,
  disabled = false,
}: WarehousePickOutcomeBarProps) {
  return (
    <div
      className="flex gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      data-testid="pick-outcome-bar"
    >
      <Button
        className="min-h-[64px] flex-1 touch-target gap-2 bg-emerald-600 text-[var(--color-text-inverted)] hover:bg-emerald-700"
        onClick={() => onOutcome("picked")}
        disabled={disabled}
        data-testid="pick-picked"
      >
        <Check className="h-5 w-5" />
        Picked
      </Button>
      <Button
        className="min-h-[64px] flex-1 touch-target gap-2 bg-red-600 text-[var(--color-text-inverted)] hover:bg-red-700"
        onClick={() => onOutcome("not_available")}
        disabled={disabled}
        data-testid="pick-not-available"
      >
        <X className="h-5 w-5" />
        Not Available
      </Button>
      <Button
        className="min-h-[64px] flex-1 touch-target gap-2 bg-amber-500 text-[var(--color-text-inverted)] hover:bg-amber-600"
        onClick={() => onOutcome("substitute")}
        disabled={disabled}
        data-testid="pick-substitute"
      >
        <RefreshCw className="h-5 w-5" />
        Substitute
      </Button>
    </div>
  )
}
