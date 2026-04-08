import { useRef, useState } from "react"
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/ui/button"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { ImageLightbox } from "@/shared/components/ImageLightbox"
import { normalizeGender } from "@/features/library/lib/measurementOptions"
import {
  buildDisplayName,
  initials,
  SELECT_NONE,
} from "@/features/library/components/talentUtils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { TalentRecord } from "@/shared/types"

function genderBadgeClasses(gender: string | null | undefined): string {
  const key = normalizeGender(gender)
  if (key === "men") return "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)] border-[var(--color-status-blue-border)]"
  if (key === "women") return "bg-[var(--color-status-purple-bg)] text-[var(--color-status-purple-text)] border-[var(--color-status-purple-border)]"
  return "bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)] border-[var(--color-status-gray-border)]"
}

function genderDisplayLabel(gender: string | null | undefined): string {
  if (!gender) return ""
  const map: Record<string, string> = {
    male: "Male",
    female: "Female",
    "non-binary": "Non-binary",
    other: "Other",
  }
  return map[gender.toLowerCase()] ?? gender
}

interface TalentHeroZoneProps {
  readonly selected: TalentRecord
  readonly canEdit: boolean
  readonly busy: boolean
  readonly selectedHeadshotUrl: string | null
  readonly selectedHeadshotPath: string | null
  readonly savePatch: (id: string, patch: Record<string, unknown>) => Promise<void>
  readonly onHeadshotFile: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly setHeadshotRemoveOpen: (open: boolean) => void
}

export function TalentHeroZone({
  selected,
  canEdit,
  busy,
  selectedHeadshotUrl,
  selectedHeadshotPath,
  savePatch,
  onHeadshotFile,
  setHeadshotRemoveOpen,
}: TalentHeroZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const displayName = buildDisplayName(selected)

  return (
    <div className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:items-start sm:text-left sm:gap-5">
      {/* Headshot */}
      <div className="flex-shrink-0">
        <div
          className={`h-44 w-44 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)]${selectedHeadshotUrl ? " cursor-pointer" : ""}`}
          {...(selectedHeadshotUrl
            ? {
                role: "button" as const,
                tabIndex: 0,
                "aria-label": "View full headshot",
                onClick: () => setLightboxOpen(true),
                onKeyDown: (e: ReactKeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setLightboxOpen(true)
                  }
                },
              }
            : {})}
        >
          {selectedHeadshotUrl ? (
            <img
              src={selectedHeadshotUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-subtle)]">
              {initials(displayName)}
            </div>
          )}
        </div>

        {/* Upload / Remove buttons */}
        {canEdit ? (
          <div className="mt-2 flex justify-center gap-2 sm:justify-start">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onHeadshotFile}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3 w-3 mr-1.5" />
              Upload
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !selectedHeadshotPath}
              onClick={() => setHeadshotRemoveOpen(true)}
            >
              Remove
            </Button>
          </div>
        ) : null}
      </div>

      {/* Name, Agency, Gender */}
      <div className="min-w-0 flex-1">
        <div data-testid="talent-details-name" className="min-w-0">
          <InlineEdit
            value={displayName}
            disabled={!canEdit || busy}
            placeholder="Untitled"
            onSave={(next) => void savePatch(selected.id, { name: next })}
            className="heading-page break-words"
            showEditIcon={canEdit && !busy}
          />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 justify-center sm:justify-start">
          {/* Gender badge */}
          {selected.gender ? (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${genderBadgeClasses(selected.gender)}`}
            >
              {genderDisplayLabel(selected.gender)}
            </span>
          ) : null}

          {/* Agency */}
          {canEdit ? (
            <InlineEdit
              value={selected.agency ?? ""}
              disabled={busy}
              placeholder="Add agency"
              onSave={(next) => void savePatch(selected.id, { agency: next || null })}
              className="text-sm text-[var(--color-text-muted)]"
              showEditIcon
            />
          ) : selected.agency ? (
            <span className="text-sm text-[var(--color-text-muted)]">{selected.agency}</span>
          ) : null}
        </div>

        {/* Gender select — only visible when canEdit */}
        {canEdit ? (
          <div className="mt-3">
            <div className="label-meta mb-1">Gender</div>
            <Select
              value={selected.gender ?? SELECT_NONE}
              onValueChange={(next) =>
                void savePatch(selected.id, {
                  gender: next === SELECT_NONE ? null : next,
                })
              }
              disabled={busy}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE}>—</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="non-binary">Non-binary</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {/* Headshot lightbox */}
      {selectedHeadshotUrl ? (
        <ImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          images={[selectedHeadshotUrl]}
          alt={displayName}
        />
      ) : null}
    </div>
  )
}
