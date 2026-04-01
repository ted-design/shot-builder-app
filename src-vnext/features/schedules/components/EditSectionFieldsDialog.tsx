import { useCallback, useState } from "react"
import { Eye, EyeOff, GripVertical, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  FIELD_WIDTH_LABELS,
  resetAllFields,
  resetField,
  reorderField,
  toggleFieldVisibility,
  updateFieldLabel,
  updateFieldWidth,
  updateSectionTitle,
  type CallSheetSectionFieldConfig,
  type FieldWidth,
} from "@/features/schedules/lib/fieldConfig"

interface EditSectionFieldsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly config: CallSheetSectionFieldConfig
  readonly onSave: (config: CallSheetSectionFieldConfig) => void
}

export function EditSectionFieldsDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: EditSectionFieldsDialogProps) {
  const [draft, setDraft] = useState<CallSheetSectionFieldConfig>(config)
  const sortedFields = [...draft.fields].sort((a, b) => a.order - b.order)

  // Reset draft when dialog opens with new config
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setDraft(config)
      }
      onOpenChange(nextOpen)
    },
    [config, onOpenChange],
  )

  const handleSave = useCallback(() => {
    onSave(draft)
    onOpenChange(false)
  }, [draft, onSave, onOpenChange])

  const handleCancel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleResetAll = useCallback(() => {
    setDraft(resetAllFields(draft))
  }, [draft])

  const handleTitleChange = useCallback(
    (value: string) => {
      setDraft(updateSectionTitle(draft, value))
    },
    [draft],
  )

  const handleLabelChange = useCallback(
    (fieldKey: string, label: string) => {
      setDraft(updateFieldLabel(draft, fieldKey, label))
    },
    [draft],
  )

  const handleWidthChange = useCallback(
    (fieldKey: string, width: FieldWidth) => {
      setDraft(updateFieldWidth(draft, fieldKey, width))
    },
    [draft],
  )

  const handleToggleVisibility = useCallback(
    (fieldKey: string) => {
      setDraft(toggleFieldVisibility(draft, fieldKey))
    },
    [draft],
  )

  const handleResetField = useCallback(
    (fieldKey: string) => {
      setDraft(resetField(draft, fieldKey))
    },
    [draft],
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", String(index))
    },
    [],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
      e.preventDefault()
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10)
      if (Number.isNaN(fromIndex)) return
      setDraft(reorderField(draft, fromIndex, toIndex))
    },
    [draft],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Edit Section</DialogTitle>
          <DialogDescription>
            Customize columns for the {config.defaultTitle} section.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Section title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="section-title" className="text-xs font-medium">
              Section Title
            </Label>
            <Input
              id="section-title"
              value={draft.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="h-8 text-sm"
              maxLength={100}
            />
          </div>

          {/* Fields header */}
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Fields
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-2xs"
              onClick={handleResetAll}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset all to default
            </Button>
          </div>

          {/* Field list */}
          <div className="flex flex-col gap-1" role="list" aria-label="Field configuration list">
            {sortedFields.map((field, index) => {
              const isModified = field.label !== field.defaultLabel
              return (
                <div
                  key={field.key}
                  role="listitem"
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5"
                >
                  {/* Drag handle */}
                  <div
                    className="shrink-0 cursor-grab text-[var(--color-text-subtle)]"
                    aria-label={`Drag to reorder ${field.label}`}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Label input */}
                  <Input
                    value={field.label}
                    onChange={(e) => handleLabelChange(field.key, e.target.value)}
                    className="h-7 min-w-0 flex-1 text-xs"
                    aria-label={`Label for ${field.defaultLabel}`}
                    maxLength={50}
                  />

                  {/* Width selector */}
                  <Select
                    value={field.width}
                    onValueChange={(v) => handleWidthChange(field.key, v as FieldWidth)}
                  >
                    <SelectTrigger
                      className="h-7 w-16 shrink-0 text-xs"
                      aria-label={`Width for ${field.label}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(FIELD_WIDTH_LABELS) as [FieldWidth, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  {/* Visibility toggle */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleToggleVisibility(field.key)}
                    aria-label={field.visible ? `Hide ${field.label}` : `Show ${field.label}`}
                  >
                    {field.visible ? (
                      <Eye className="h-3.5 w-3.5 text-[var(--color-text)]" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" />
                    )}
                  </Button>

                  {/* Original label + reset */}
                  {isModified && (
                    <button
                      type="button"
                      onClick={() => handleResetField(field.key)}
                      className="shrink-0 text-2xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
