import { useState } from "react"
import { useAuth } from "@/app/providers/AuthProvider"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import {
  SHOT_STATUSES,
  getShotStatusLabel,
} from "@/shared/lib/statusMappings"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import { toast } from "sonner"

interface ShotStatusTapRowProps {
  readonly shot: Shot
  readonly disabled?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  gray: "bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)] border-[var(--color-status-gray-border)]",
  blue: "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)] border-[var(--color-status-blue-border)]",
  green: "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)] border-[var(--color-status-green-border)]",
  amber: "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)] border-[var(--color-status-amber-border)]",
}

const ACTIVE_COLORS: Record<string, string> = {
  gray: "bg-[var(--color-status-gray-text)] text-[var(--color-text-inverted)] border-[var(--color-status-gray-text)]",
  blue: "bg-[var(--color-status-blue-text)] text-[var(--color-text-inverted)] border-[var(--color-status-blue-text)]",
  green: "bg-[var(--color-status-green-text)] text-[var(--color-text-inverted)] border-[var(--color-status-green-text)]",
  amber: "bg-[var(--color-status-amber-text)] text-[var(--color-text-inverted)] border-[var(--color-status-amber-text)]",
}

/**
 * Horizontal row of 4 pill buttons for 1-tap status change on mobile.
 * Replaces ShotStatusSelect on phone viewports.
 */
export function ShotStatusTapRow({ shot, disabled = false }: ShotStatusTapRowProps) {
  const { clientId, user } = useAuth()
  const [optimistic, setOptimistic] = useState<ShotFirestoreStatus | null>(null)
  const displayStatus = optimistic ?? shot.status

  const handleTap = async (newStatus: ShotFirestoreStatus) => {
    if (newStatus === displayStatus || disabled || !clientId) return

    const prev = shot.status
    setOptimistic(newStatus)

    try {
      await updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: { status: newStatus },
        shot,
        user,
        source: "ShotStatusTapRow",
      })
      setOptimistic(null)
    } catch {
      setOptimistic(null)
      toast.error("Failed to update status", {
        description: `Reverted to ${getShotStatusLabel(prev)}`,
      })
    }
  }

  return (
    <div className="flex gap-2" data-testid="status-tap-row">
      {SHOT_STATUSES.map((s) => {
        const isActive = s.firestoreValue === displayStatus
        const colors = isActive
          ? (ACTIVE_COLORS[s.color] ?? ACTIVE_COLORS.gray)
          : (STATUS_COLORS[s.color] ?? STATUS_COLORS.gray)

        return (
          <button
            key={s.firestoreValue}
            type="button"
            onClick={() => handleTap(s.firestoreValue)}
            disabled={disabled}
            className={`min-h-[44px] flex-1 touch-target rounded-full border px-3 py-2 text-xs font-medium transition-colors ${colors} ${
              disabled ? "opacity-50" : ""
            }`}
            data-testid={`status-tap-${s.firestoreValue}`}
            aria-pressed={isActive}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
