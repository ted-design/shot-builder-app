import { useCallback, useState } from "react"
import { LayoutTemplate, Pencil, Sliders } from "lucide-react"
import { Checkbox } from "@/ui/checkbox"
import { Switch } from "@/ui/switch"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { DEFAULT_CALLSHEET_COLORS } from "@/features/schedules/lib/callSheetConfig"
import { SECTION_META } from "@/features/schedules/lib/callSheetLayouts"
import {
  DEFAULT_CAST_SECTION,
  DEFAULT_CREW_SECTION,
  type CallSheetSectionFieldConfig,
} from "@/features/schedules/lib/fieldConfig"
import { CallSheetLayoutDialog } from "@/features/schedules/components/CallSheetLayoutDialog"
import { EditSectionFieldsDialog } from "@/features/schedules/components/EditSectionFieldsDialog"
import { SaveIndicator } from "@/shared/components/SaveIndicator"
import type {
  CallSheetColors,
  CallSheetHeaderLayout,
  CallSheetSectionVisibility,
  ScheduleBlockFields,
} from "@/features/schedules/components/CallSheetRenderer"
import type { ScheduleTrack } from "@/shared/types"

interface CallSheetOutputControlsProps {
  readonly tracks?: readonly ScheduleTrack[]
  readonly activeTrackId?: string | null
  readonly onActiveTrackChange?: (trackId: string | null) => void
  readonly sections: Required<CallSheetSectionVisibility>
  readonly scheduleBlockFields: Required<ScheduleBlockFields>
  readonly colors: Required<CallSheetColors>
  readonly headerLayout: CallSheetHeaderLayout
  readonly castFieldConfig?: CallSheetSectionFieldConfig
  readonly crewFieldConfig?: CallSheetSectionFieldConfig
  // Timestamp driving the "Saved Xs ago" pill in the Output header.
  // Owned by the parent (CallSheetBuilderPage) because all of the
  // output-config writes are routed through parent handlers.
  readonly savedAt?: number | null
  readonly onPatchSections: (
    patch: Partial<Required<CallSheetSectionVisibility>>,
  ) => void
  readonly onPatchScheduleFields: (
    patch: Partial<Required<ScheduleBlockFields>>,
  ) => void
  readonly onPatchColors: (patch: Partial<Required<CallSheetColors>>) => void
  readonly onSetHeaderLayout: (layout: CallSheetHeaderLayout) => void
  readonly onSaveSectionFieldConfig?: (
    sectionKey: string,
    config: CallSheetSectionFieldConfig,
  ) => void
}

export function CallSheetOutputControls({
  tracks = [],
  activeTrackId = null,
  onActiveTrackChange,
  sections,
  scheduleBlockFields,
  colors,
  headerLayout,
  castFieldConfig,
  crewFieldConfig,
  savedAt = null,
  onPatchSections,
  onPatchScheduleFields,
  onPatchColors,
  onSetHeaderLayout,
  onSaveSectionFieldConfig,
}: CallSheetOutputControlsProps) {
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false)
  const [editCastOpen, setEditCastOpen] = useState(false)
  const [editCrewOpen, setEditCrewOpen] = useState(false)

  const onChecked = useCallback(
    (fn: (value: boolean) => void) => (value: boolean | "indeterminate") => {
      if (value === "indeterminate") return
      fn(value)
    },
    [],
  )

  const handleApplyLayout = useCallback(
    (visibility: Required<CallSheetSectionVisibility>) => {
      onPatchSections(visibility)
    },
    [onPatchSections],
  )

  const handleSaveCastFields = useCallback(
    (config: CallSheetSectionFieldConfig) => {
      onSaveSectionFieldConfig?.("cast", config)
    },
    [onSaveSectionFieldConfig],
  )

  const handleSaveCrewFields = useCallback(
    (config: CallSheetSectionFieldConfig) => {
      onSaveSectionFieldConfig?.("crew", config)
    },
    [onSaveSectionFieldConfig],
  )

  const isDefaultColors = colors.primary === DEFAULT_CALLSHEET_COLORS.primary
    && colors.accent === DEFAULT_CALLSHEET_COLORS.accent
    && colors.text === DEFAULT_CALLSHEET_COLORS.text

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <CallSheetLayoutDialog
        open={layoutDialogOpen}
        onOpenChange={setLayoutDialogOpen}
        currentSections={sections}
        onApplyLayout={handleApplyLayout}
      />

      <EditSectionFieldsDialog
        open={editCastOpen}
        onOpenChange={setEditCastOpen}
        config={castFieldConfig ?? DEFAULT_CAST_SECTION}
        onSave={handleSaveCastFields}
      />

      <EditSectionFieldsDialog
        open={editCrewOpen}
        onOpenChange={setEditCrewOpen}
        config={crewFieldConfig ?? DEFAULT_CREW_SECTION}
        onSave={handleSaveCrewFields}
      />

      <div className="flex items-center gap-2">
        <Sliders className="h-4 w-4 text-[var(--color-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Output
        </h2>
        <SaveIndicator savedAt={savedAt} />
      </div>

      {tracks.length >= 2 && onActiveTrackChange && (
        <div className="flex flex-col gap-1.5">
          <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Export Unit
          </p>
          <Select
            value={activeTrackId ?? "all"}
            onValueChange={(v) => onActiveTrackChange(v === "all" ? null : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All Units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {tracks.map((track) => (
                <SelectItem key={track.id} value={track.id}>
                  {track.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Sections
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-2xs font-semibold uppercase tracking-wider"
            onClick={() => setLayoutDialogOpen(true)}
          >
            <LayoutTemplate className="h-3 w-3" />
            Layouts
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {SECTION_META.map((meta) => (
            <div key={meta.key} className="flex items-center justify-between gap-2">
              <Label htmlFor={`cs-sec-${meta.key}`} className="text-xs">
                {meta.label}
              </Label>
              <div className="flex items-center gap-1">
                {/* Edit Fields button for talent and crew sections */}
                {meta.key === "talent" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-2xs text-[var(--color-text-muted)]"
                    onClick={() => setEditCastOpen(true)}
                    aria-label="Edit cast fields"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                {meta.key === "crew" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-2xs text-[var(--color-text-muted)]"
                    onClick={() => setEditCrewOpen(true)}
                    aria-label="Edit crew fields"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
                <Switch
                  id={`cs-sec-${meta.key}`}
                  checked={sections[meta.key]}
                  onCheckedChange={(checked) =>
                    onPatchSections({ [meta.key]: checked })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Schedule Fields
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-f-shotnum"
              checked={scheduleBlockFields.showShotNumber}
              onCheckedChange={onChecked((v) => onPatchScheduleFields({ showShotNumber: v }))}
            />
            <Label htmlFor="cs-f-shotnum" className="text-xs">
              Shot #
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-f-shotname"
              checked={scheduleBlockFields.showShotName}
              onCheckedChange={onChecked((v) => onPatchScheduleFields({ showShotName: v }))}
            />
            <Label htmlFor="cs-f-shotname" className="text-xs">
              Name
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-f-desc"
              checked={scheduleBlockFields.showDescription}
              onCheckedChange={onChecked((v) => onPatchScheduleFields({ showDescription: v }))}
            />
            <Label htmlFor="cs-f-desc" className="text-xs">
              Description
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-f-talent"
              checked={scheduleBlockFields.showTalent}
              onCheckedChange={onChecked((v) => onPatchScheduleFields({ showTalent: v }))}
            />
            <Label htmlFor="cs-f-talent" className="text-xs">
              Talent
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-f-location"
              checked={scheduleBlockFields.showLocation}
              onCheckedChange={onChecked((v) => onPatchScheduleFields({ showLocation: v }))}
            />
            <Label htmlFor="cs-f-location" className="text-xs">
              Location
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-f-tags"
              checked={scheduleBlockFields.showTags}
              onCheckedChange={onChecked((v) => onPatchScheduleFields({ showTags: v }))}
            />
            <Label htmlFor="cs-f-tags" className="text-xs">
              Tags
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-f-notes"
              checked={scheduleBlockFields.showNotes}
              onCheckedChange={onChecked((v) => onPatchScheduleFields({ showNotes: v }))}
            />
            <Label htmlFor="cs-f-notes" className="text-xs">
              Notes
            </Label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Colors
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-2xs font-semibold uppercase tracking-wider"
            disabled={isDefaultColors}
            onClick={() => onPatchColors({ ...DEFAULT_CALLSHEET_COLORS })}
          >
            Reset Defaults
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="cs-color-primary" className="text-2xs text-[var(--color-text-muted)]">
              Primary
            </Label>
            <Input
              id="cs-color-primary"
              type="color"
              value={colors.primary || DEFAULT_CALLSHEET_COLORS.primary}
              onChange={(e) => onPatchColors({ primary: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cs-color-accent" className="text-2xs text-[var(--color-text-muted)]">
              Accent
            </Label>
            <Input
              id="cs-color-accent"
              type="color"
              value={colors.accent || DEFAULT_CALLSHEET_COLORS.accent}
              onChange={(e) => onPatchColors({ accent: e.target.value })}
              className="h-9 p-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="cs-color-text" className="text-2xs text-[var(--color-text-muted)]">
              Text
            </Label>
            <Input
              id="cs-color-text"
              type="color"
              value={colors.text || DEFAULT_CALLSHEET_COLORS.text}
              onChange={(e) => onPatchColors({ text: e.target.value })}
              className="h-9 p-1"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Header Layout
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={headerLayout === "legacy" ? "secondary" : "outline"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onSetHeaderLayout("legacy")}
          >
            Standard
          </Button>
          <Button
            type="button"
            variant={headerLayout === "grid" ? "secondary" : "outline"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => onSetHeaderLayout("grid")}
          >
            Grid Header
          </Button>
        </div>
      </div>
    </div>
  )
}
