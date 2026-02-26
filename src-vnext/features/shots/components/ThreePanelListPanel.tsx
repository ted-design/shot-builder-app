import { useEffect, useMemo, useRef, useState } from "react"
import { Search, Settings2 } from "lucide-react"
import { ShotQuickAdd } from "@/features/shots/components/ShotQuickAdd"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { getShotStatusLabel, getShotStatusColor } from "@/shared/lib/statusMappings"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { textPreview } from "@/shared/lib/textPreview"
import { useListDisplayPreferences } from "@/features/shots/hooks/useListDisplayPreferences"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { Switch } from "@/ui/switch"
import type { ListDisplayPreferences } from "@/features/shots/hooks/useListDisplayPreferences"
import type { Shot } from "@/shared/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Density = "compact" | "medium" | "full"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreePanelListPanelProps {
  readonly shots: ReadonlyArray<Shot>
  readonly allShots: ReadonlyArray<Shot>
  readonly selectedShotId: string | null
  readonly onSelectShot: (shotId: string) => void
  readonly showCreate: boolean
  readonly onShotCreated?: (shotId: string, title: string) => void
}

// ---------------------------------------------------------------------------
// Density thresholds
// ---------------------------------------------------------------------------

function widthToDensity(width: number): Density {
  if (width < 200) return "compact"
  if (width <= 280) return "medium"
  return "full"
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreePanelListPanel({
  shots,
  allShots,
  selectedShotId,
  onSelectShot,
  showCreate,
  onShotCreated,
}: ThreePanelListPanelProps) {
  const [localSearch, setLocalSearch] = useState("")
  const [density, setDensity] = useState<Density>("full")
  const containerRef = useRef<HTMLDivElement>(null)
  const [prefs, togglePref] = useListDisplayPreferences()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setDensity(widthToDensity(width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const filteredShots = useMemo(() => {
    const q = localSearch.trim().toLowerCase()
    if (!q) return shots
    return shots.filter((s) => {
      const title = (s.title ?? "").toLowerCase()
      const num = (s.shotNumber ?? "").toLowerCase()
      return title.includes(q) || num.includes(q)
    })
  }, [shots, localSearch])

  return (
    <div ref={containerRef} className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--color-text)]">
            Shots
          </span>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-[var(--color-text-subtle)]">
              {filteredShots.length}
            </span>
            <DisplayPreferencesPopover prefs={prefs} togglePref={togglePref} />
          </div>
        </div>

        {/* Local search */}
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-subtle)]" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Filter shots..."
            className="w-full bg-transparent text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none"
          />
        </div>
      </div>

      {/* Quick-add */}
      {showCreate && (
        <div className="flex-shrink-0 border-b border-[var(--color-border)] px-2 py-2">
          <ShotQuickAdd shots={allShots} onCreated={onShotCreated} compact />
        </div>
      )}

      {/* Shot list */}
      <div className="flex-1 overflow-y-auto">
        {filteredShots.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-[var(--color-text-muted)]">
            No matching shots
          </div>
        ) : (
          filteredShots.map((shot) => (
            <ListItem
              key={shot.id}
              shot={shot}
              isSelected={shot.id === selectedShotId}
              onSelect={onSelectShot}
              density={density}
              prefs={prefs}
            />
          ))
        )}
      </div>

      {/* Keyboard hints footer */}
      <div className="flex-shrink-0 border-t border-[var(--color-border)] px-3 py-1.5">
        <div className="flex items-center gap-3 text-3xs text-[var(--color-text-subtle)]">
          <span>
            <kbd className="rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-1 text-3xs">Esc</kbd>{" "}
            close
          </span>
          <span>
            <kbd className="rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-1 text-3xs">[</kbd>
            <kbd className="rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-1 text-3xs">]</kbd>{" "}
            prev/next
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DisplayPreferencesPopover
// ---------------------------------------------------------------------------

function DisplayPreferencesPopover({
  prefs,
  togglePref,
}: {
  readonly prefs: ListDisplayPreferences
  readonly togglePref: (key: keyof ListDisplayPreferences) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded p-0.5 text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          title="Display preferences"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-3" sideOffset={4}>
        <p className="mb-2.5 text-xxs font-semibold text-[var(--color-text)]">
          Display preferences
        </p>
        <div className="flex flex-col gap-2">
          <PreferenceRow
            label="Thumbnails"
            checked={prefs.showThumbnail}
            onToggle={() => togglePref("showThumbnail")}
          />
          <PreferenceRow
            label="Shot number"
            checked={prefs.showShotNumber}
            onToggle={() => togglePref("showShotNumber")}
          />
          <PreferenceRow
            label="Description"
            checked={prefs.showDescription}
            onToggle={() => togglePref("showDescription")}
          />
          <PreferenceRow
            label="Status badge"
            checked={prefs.showStatusBadge}
            onToggle={() => togglePref("showStatusBadge")}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PreferenceRow({
  label,
  checked,
  onToggle,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onToggle: () => void
}) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </label>
  )
}

// ---------------------------------------------------------------------------
// ListItem
// ---------------------------------------------------------------------------

function ListItem({
  shot,
  isSelected,
  onSelect,
  density,
  prefs,
}: {
  readonly shot: Shot
  readonly isSelected: boolean
  readonly onSelect: (shotId: string) => void
  readonly density: Density
  readonly prefs: ListDisplayPreferences
}) {
  const heroCandidate = shot.heroImage?.downloadURL ?? shot.heroImage?.path
  const heroUrl = useStorageUrl(heroCandidate)
  const descriptionPreview = useMemo(
    () => (density === "full" && prefs.showDescription ? textPreview(shot.description, 120) : ""),
    [shot.description, density, prefs.showDescription],
  )

  // Both density tier AND preferences determine visibility
  const showThumbnail = density !== "compact" && prefs.showThumbnail
  const showBadge = density !== "compact" && prefs.showStatusBadge
  const showShotNumber = prefs.showShotNumber && !!shot.shotNumber
  const showDescription = density === "full" && prefs.showDescription && descriptionPreview.length > 0

  return (
    <button
      type="button"
      onClick={() => onSelect(shot.id)}
      className={`flex w-full gap-2.5 border-l-[3px] px-2.5 py-2 text-left transition-colors ${
        showDescription ? "items-start" : "items-center"
      } ${
        isSelected
          ? "border-l-[var(--color-text)] bg-[var(--color-surface-subtle)]"
          : "border-l-transparent hover:bg-[var(--color-surface-subtle)]"
      }`}
    >
      {/* Thumbnail */}
      {showThumbnail && (
        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded bg-[var(--color-surface-subtle)]">
          {heroUrl ? (
            <img
              src={heroUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--color-text-subtle)]">
              <span className="text-3xs">--</span>
            </div>
          )}
        </div>
      )}

      {/* Title + shot number + description */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate text-xs font-medium text-[var(--color-text)]">
            {shot.title || "Untitled"}
          </span>
          {showBadge && (
            <StatusBadge
              label={getShotStatusLabel(shot.status)}
              color={getShotStatusColor(shot.status)}
            />
          )}
        </div>
        {showShotNumber && (
          <div className="text-3xs text-[var(--color-text-subtle)]">
            #{shot.shotNumber}
          </div>
        )}
        {showDescription && (
          <div className="mt-0.5 line-clamp-2 text-3xs text-[var(--color-text-muted)]">
            {descriptionPreview}
          </div>
        )}
      </div>
    </button>
  )
}
