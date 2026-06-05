import { useMemo } from "react"
import { ExternalLink, FileText } from "lucide-react"
import { Card } from "@/ui/card"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { textPreview } from "@/shared/lib/textPreview"
import { getBriefHost, isSafeHttpUrl } from "@/features/projects/lib/projectStatus"

/**
 * BriefCard — the "The Brief" zone (mockup 01-A-ledger-desktop.html `.brief`).
 *
 * Read-only presentation of a project's brief link + notes preview:
 *   - `briefUrl`  → an "Open brief" link with a host label (via getBriefHost),
 *                   opening in a new tab.
 *   - `notes`     → a serif notes preview (textPreview, HTML-stripped + truncated).
 *
 * Renders an {@link InlineEmpty} when neither a brief URL nor notes exist.
 *
 * Pure presentation: takes already-fetched project fields as props; performs no
 * reads and no writes. All colors/fonts come from design tokens.
 */
export interface BriefCardProps {
  /** The project's brief URL (`Project.briefUrl`); optional. */
  readonly briefUrl?: string | null
  /** The project's notes (`Project.notes`); may contain HTML; optional. */
  readonly notes?: string | null
  /** Max characters for the notes preview. */
  readonly notesMaxLength?: number
}

export function BriefCard({ briefUrl, notes, notesMaxLength = 220 }: BriefCardProps) {
  // Only render the brief link for http(s) URLs — a stored `javascript:`/`data:`
  // URL would otherwise execute on click (see isSafeHttpUrl).
  const safeUrl = useMemo(() => (isSafeHttpUrl(briefUrl) ? briefUrl!.trim() : ""), [briefUrl])
  const briefHost = useMemo(() => getBriefHost(safeUrl), [safeUrl])
  const notesPreview = useMemo(() => textPreview(notes, notesMaxLength), [notes, notesMaxLength])

  const hasBrief = safeUrl.length > 0
  const hasNotes = notesPreview.length > 0

  if (!hasBrief && !hasNotes) {
    return (
      <Card
        className="border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        aria-labelledby="brief-card-label"
      >
        <p
          id="brief-card-label"
          className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]"
        >
          The Brief
        </p>
        <div className="mt-3">
          <InlineEmpty
            icon={<FileText className="h-7 w-7" aria-hidden="true" />}
            title="No brief yet"
            description="Add a brief link or project notes to give the team context."
          />
        </div>
      </Card>
    )
  }

  return (
    <Card
      className="border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      aria-labelledby="brief-card-label"
    >
      <p
        id="brief-card-label"
        className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]"
      >
        The Brief
      </p>

      {hasNotes && (
        <p
          className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {notesPreview}
        </p>
      )}

      {hasBrief && (
        <div className="mt-4 space-y-2">
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-text-secondary)]"
          >
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            Open brief
          </a>
          {briefHost && (
            <p className="text-xs text-[var(--color-text-subtle)]">{briefHost}</p>
          )}
        </div>
      )}
    </Card>
  )
}
