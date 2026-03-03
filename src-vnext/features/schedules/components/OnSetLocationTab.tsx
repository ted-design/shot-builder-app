import { MapPin, Navigation } from "lucide-react"
import type { DayDetails } from "@/shared/types"

function buildMapsUrl(address: string): string {
  const encoded = encodeURIComponent(address)
  const ua = navigator.userAgent
  // Use Apple Maps on iOS devices; Google Maps everywhere else
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  if (isIOS) {
    return `maps://maps.apple.com/?q=${encoded}`
  }
  return `https://maps.google.com/?q=${encoded}`
}

interface OnSetLocationTabProps {
  dayDetails: DayDetails | null
}

export function OnSetLocationTab({ dayDetails }: OnSetLocationTabProps) {
  const locations = dayDetails?.locations ?? []
  const primaryLocation = locations[0] ?? null

  const locationLabel = primaryLocation?.ref?.label ?? primaryLocation?.title ?? null
  const locationNotes = primaryLocation?.ref?.notes ?? null

  if (!locationLabel && !locationNotes) {
    return (
      <div className="px-4 pt-6 pb-3">
        <h3 className="heading-subsection mb-3">Location</h3>
        <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
          No location details added.
        </p>
      </div>
    )
  }

  function handleDirections() {
    const query = locationLabel ?? ""
    if (query) {
      window.open(buildMapsUrl(query), "_blank", "noopener,noreferrer")
    }
  }

  return (
    <div className="px-4 pt-6 pb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="heading-subsection">Location</h3>
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        {/* Map placeholder */}
        <div
          className="h-32 flex items-center justify-center bg-[var(--color-surface-subtle)]"
        >
          <div className="text-center">
            <MapPin className="w-6 h-6 text-[var(--color-text-muted)] mx-auto mb-1" />
            <span className="text-2xs text-[var(--color-text-muted)]">Map preview</span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {locationLabel && (
            <div>
              <p className="text-3xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                Studio Address
              </p>
              <p className="text-sm font-medium text-[var(--color-text)]">{locationLabel}</p>
              {locationNotes && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{locationNotes}</p>
              )}
              <button
                type="button"
                className="mt-2 w-full h-10 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.97] bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                onClick={handleDirections}
              >
                <Navigation className="w-4 h-4" />
                Get Directions
              </button>
            </div>
          )}

          {locations.length > 1 && (
            <>
              <div className="border-t border-[var(--color-border)]" />
              {locations.slice(1).map((loc) => {
                const label = loc.ref?.label ?? loc.title
                const notes = loc.ref?.notes
                return (
                  <div key={loc.id}>
                    <p className="text-3xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                      {loc.title}
                    </p>
                    {label && (
                      <p className="text-sm font-medium text-[var(--color-text)]">{label}</p>
                    )}
                    {notes && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{notes}</p>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
