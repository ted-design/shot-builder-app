import { useCallback } from "react"
import { Sliders } from "lucide-react"
import { Checkbox } from "@/ui/checkbox"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { DEFAULT_CALLSHEET_COLORS } from "@/features/schedules/lib/callSheetConfig"
import type {
  CallSheetColors,
  CallSheetSectionVisibility,
  ScheduleBlockFields,
} from "@/features/schedules/components/CallSheetRenderer"

interface CallSheetOutputControlsProps {
  readonly sections: Required<CallSheetSectionVisibility>
  readonly scheduleBlockFields: Required<ScheduleBlockFields>
  readonly colors: Required<CallSheetColors>
  readonly onPatchSections: (
    patch: Partial<Required<CallSheetSectionVisibility>>,
  ) => void
  readonly onPatchScheduleFields: (
    patch: Partial<Required<ScheduleBlockFields>>,
  ) => void
  readonly onPatchColors: (patch: Partial<Required<CallSheetColors>>) => void
}

export function CallSheetOutputControls({
  sections,
  scheduleBlockFields,
  colors,
  onPatchSections,
  onPatchScheduleFields,
  onPatchColors,
}: CallSheetOutputControlsProps) {
  const onChecked = useCallback(
    (fn: (value: boolean) => void) => (value: boolean | "indeterminate") => {
      if (value === "indeterminate") return
      fn(value)
    },
    [],
  )

  const isDefaultColors = colors.primary === DEFAULT_CALLSHEET_COLORS.primary
    && colors.accent === DEFAULT_CALLSHEET_COLORS.accent
    && colors.text === DEFAULT_CALLSHEET_COLORS.text

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2">
        <Sliders className="h-4 w-4 text-[var(--color-text-muted)]" />
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Output
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Sections
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-sec-header"
              checked={sections.header}
              onCheckedChange={onChecked((v) => onPatchSections({ header: v }))}
            />
            <Label htmlFor="cs-sec-header" className="text-xs">
              Header
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-sec-day"
              checked={sections.dayDetails}
              onCheckedChange={onChecked((v) => onPatchSections({ dayDetails: v }))}
            />
            <Label htmlFor="cs-sec-day" className="text-xs">
              Day Details
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-sec-sched"
              checked={sections.schedule}
              onCheckedChange={onChecked((v) => onPatchSections({ schedule: v }))}
            />
            <Label htmlFor="cs-sec-sched" className="text-xs">
              Schedule
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-sec-talent"
              checked={sections.talent}
              onCheckedChange={onChecked((v) => onPatchSections({ talent: v }))}
            />
            <Label htmlFor="cs-sec-talent" className="text-xs">
              Talent
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-sec-crew"
              checked={sections.crew}
              onCheckedChange={onChecked((v) => onPatchSections({ crew: v }))}
            />
            <Label htmlFor="cs-sec-crew" className="text-xs">
              Crew
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="cs-sec-notes"
              checked={sections.notes}
              onCheckedChange={onChecked((v) => onPatchSections({ notes: v }))}
            />
            <Label htmlFor="cs-sec-notes" className="text-xs">
              Notes
            </Label>
          </div>
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
    </div>
  )
}
