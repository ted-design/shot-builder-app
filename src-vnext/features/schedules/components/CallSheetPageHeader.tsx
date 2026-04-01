import { formatHHMMTo12h } from "@/features/schedules/lib/time"
import type { Schedule, DayDetails } from "@/shared/types"

interface CallSheetPageHeaderProps {
  readonly projectName: string
  readonly scheduleName: string
  readonly schedule: Schedule
  readonly dayDetails: DayDetails | null
}

function formatDate(date: Schedule["date"]): { day: string; full: string } {
  if (!date) return { day: "", full: "" }
  try {
    const d = date.toDate()
    const day = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()
    const full = d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    return { day, full }
  } catch {
    return { day: "", full: "" }
  }
}

/**
 * New 3-zone modular grid header for call sheets.
 * Gated behind config.headerLayout === 'grid'.
 * LEFT: project/company info
 * CENTER: production title + crew call time (hero)
 * RIGHT: date + weather
 *
 * Print strategy: this header renders in normal DOM flow on page 1.
 * Page 2+ use the .callsheet-running-header repeated DOM div.
 */
export function CallSheetPageHeader({
  projectName,
  scheduleName,
  schedule,
  dayDetails,
}: CallSheetPageHeaderProps) {
  const { day, full } = formatDate(schedule.date)
  const crewCallFormatted = dayDetails?.crewCallTime
    ? formatHHMMTo12h(dayDetails.crewCallTime) || dayDetails.crewCallTime
    : null

  const locationBlock = dayDetails?.locations?.[0] ?? null
  const locationLabel = locationBlock?.title ?? null
  const locationAddress = locationBlock?.ref?.label ?? locationBlock?.ref?.locationId ?? null

  const weatherSummary = dayDetails?.weather?.summary ?? null
  const weatherHigh = dayDetails?.weather?.highTemp ?? null
  const weatherLow = dayDetails?.weather?.lowTemp ?? null

  return (
    <div className="callsheet-header-grid-wrap">
      {/* Top accent rule */}
      <div className="callsheet-accent-rule" />

      <div className="callsheet-header-grid">
        {/* LEFT ZONE */}
        <div className="callsheet-header-zone callsheet-header-zone--left">
          <div className="callsheet-header-project">{projectName}</div>
          {scheduleName && scheduleName !== projectName && (
            <div className="callsheet-header-schedule">{scheduleName}</div>
          )}
        </div>

        {/* CENTER ZONE */}
        <div className="callsheet-header-zone callsheet-header-zone--center bg-[var(--color-surface-subtle)]">
          {crewCallFormatted && (
            <>
              <div className="callsheet-header-crew-call">{crewCallFormatted}</div>
              <div className="callsheet-header-crew-call-label">General Crew Call</div>
            </>
          )}
          {!crewCallFormatted && (
            <div className="callsheet-header-project" style={{ fontSize: "18px" }}>
              {projectName}
            </div>
          )}
        </div>

        {/* RIGHT ZONE */}
        <div className="callsheet-header-zone callsheet-header-zone--right">
          {day && <div className="callsheet-header-day">{day}</div>}
          {full && <div className="callsheet-header-date">{full}</div>}
          {(weatherHigh != null || weatherLow != null || weatherSummary) && (
            <div className="callsheet-header-weather">
              {weatherHigh != null && weatherLow != null && (
                <span>{weatherHigh}&deg; / {weatherLow}&deg;</span>
              )}
              {weatherSummary && (
                <span className="callsheet-header-weather-summary">{weatherSummary}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom accent rule */}
      <div className="callsheet-accent-rule" />

      {/* Location + parking strip */}
      {(locationLabel || locationAddress) && (
        <div className="callsheet-location-strip">
          <div>
            <span className="callsheet-location-label">Location</span>
            <span className="callsheet-location-value">
              {locationLabel && locationAddress
                ? `${locationLabel} \u2014 ${locationAddress}`
                : locationLabel ?? locationAddress}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
