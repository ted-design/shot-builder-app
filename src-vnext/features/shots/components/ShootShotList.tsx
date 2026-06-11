// Shoot list shell — the compact on-set row list (Phase 5e-II, spec §PR
// partition 5e-II).
//
// Mounted by ShotListPage INSTEAD of the card/table forks when
// `featureShootSurface` is ON and the resolved surface === 'shoot'
// (surface-keyed, not device-keyed — tablet/desktop crew get these same rows
// at desktop density, Decision F). Decision G: the FULL project shot list in
// display order — no day scoping (banked, schedules-adjacent register row).
// This is a PRESENTATION choice, not a permission boundary (spec
// §Rules-vs-UI): the compact rows are layout, not enforcement.
//
// Rows are large read-only tap targets — shot number, title, status badge,
// talent line. Tapping hands off to the page's shell click handler, which
// snapshots the VISIBLE order for the detail shell's prev/next + [ / ] keys
// and then navigates (the handleShotClick contract).
//
// Legacy shots (projectId === '', Decision D) are filtered out by the PAGE
// before the `shots` prop (they are crew-uneditable at the rules level —
// shotProjectRole's legacy arm admits only admin/global-producer);
// `hiddenLegacyCount` renders the quiet count note instead of advertising a
// guaranteed permission-denied tap.
import type { Shot } from "@/shared/types"
import { getShotStatusMapping } from "@/shared/lib/statusMappings"

// Same status token classes as ShotStatusTapRow's idle chips — the row badge
// is the read preview of the status the detail shell's tap-row writes.
const STATUS_BADGE_CLASSES: Record<string, string> = {
  gray: "bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)] border-[var(--color-status-gray-border)]",
  blue: "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)] border-[var(--color-status-blue-border)]",
  green:
    "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)] border-[var(--color-status-green-border)]",
  amber:
    "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)] border-[var(--color-status-amber-border)]",
}

export interface ShootShotListProps {
  /** Display-order shots, legacy already filtered out by the page (Decision D). */
  readonly shots: ReadonlyArray<Shot>
  /** How many legacy (projectId === '') shots the page hid — 0 renders no note. */
  readonly hiddenLegacyCount: number
  readonly talentNameById: ReadonlyMap<string, string>
  readonly onOpenShot: (shotId: string) => void
}

function talentLineFor(
  shot: Shot,
  talentNameById: ReadonlyMap<string, string>,
): string | null {
  const talentIds = shot.talentIds ?? shot.talent ?? []
  if (talentIds.length === 0) return null
  const resolved = talentIds
    .map((id) => talentNameById.get(id))
    .filter((name): name is string => Boolean(name && name.trim()))
  return resolved.length > 0 ? resolved.join(" · ") : `${talentIds.length} assigned`
}

export function ShootShotList({
  shots,
  hiddenLegacyCount,
  talentNameById,
  onOpenShot,
}: ShootShotListProps) {
  return (
    <div className="flex flex-col gap-3" data-testid="shoot-shot-list">
      {shots.length > 0 && (
        <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
          {shots.map((shot) => {
            const status = getShotStatusMapping(shot.status)
            const talentLine = talentLineFor(shot, talentNameById)
            return (
              <li key={shot.id}>
                {/* 44px+ one-hand tap target — the whole row navigates. */}
                <button
                  type="button"
                  onClick={() => onOpenShot(shot.id)}
                  className="flex min-h-[56px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-subtle)] focus-visible:bg-[var(--color-surface-subtle)] focus-visible:outline-none"
                  data-testid="shoot-shot-row"
                >
                  {shot.shotNumber && (
                    <span className="w-10 flex-shrink-0 text-xs font-semibold tabular-nums text-[var(--color-text-subtle)]">
                      #{shot.shotNumber}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-text)]">
                      {shot.title || "Untitled Shot"}
                    </span>
                    {talentLine && (
                      <span
                        className="block truncate text-xs text-[var(--color-text-muted)]"
                        data-testid="shoot-row-talent"
                      >
                        {talentLine}
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-2xs font-semibold ${
                      STATUS_BADGE_CLASSES[status.color] ?? STATUS_BADGE_CLASSES.gray
                    }`}
                    data-testid="shoot-row-status"
                  >
                    {status.label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Decision D — quiet, never an error: legacy shots exist but are not
          listed for crew. Producers file them; the shell does not. */}
      {hiddenLegacyCount > 0 && (
        <p
          className="text-xs text-[var(--color-text-muted)]"
          data-testid="shoot-legacy-hidden-note"
        >
          {hiddenLegacyCount} legacy {hiddenLegacyCount === 1 ? "shot" : "shots"} hidden —
          ask a producer
        </p>
      )}
    </div>
  )
}
