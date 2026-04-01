import { useCallback, useState } from "react"
import { toast } from "sonner"
import { Check, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import {
  BUILTIN_LAYOUTS,
  createLayout,
  deleteLayout,
  loadSavedLayouts,
  saveLayout,
  SECTION_META,
} from "@/features/schedules/lib/callSheetLayouts"
import type { CallSheetLayout } from "@/features/schedules/lib/callSheetLayouts"
import type { CallSheetSectionVisibility } from "@/features/schedules/components/CallSheetRenderer"

interface CallSheetLayoutDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly currentSections: Required<CallSheetSectionVisibility>
  readonly onApplyLayout: (visibility: Required<CallSheetSectionVisibility>) => void
}

function VisibilityPreview({
  visibility,
}: {
  readonly visibility: Required<CallSheetSectionVisibility>
}) {
  const enabled = SECTION_META.filter((s) => visibility[s.key])
  return (
    <p className="text-2xs text-[var(--color-text-muted)]">
      {enabled.length === SECTION_META.length
        ? "All sections"
        : enabled.length === 0
          ? "No sections"
          : enabled.map((s) => s.label).join(", ")}
    </p>
  )
}

function LayoutRow({
  layout,
  onLoad,
  onDelete,
}: {
  readonly layout: CallSheetLayout
  readonly onLoad: (layout: CallSheetLayout) => void
  readonly onDelete?: (id: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text)]">
          {layout.name}
        </p>
        <VisibilityPreview visibility={layout.sectionVisibility} />
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onLoad(layout)}
        >
          <Check className="mr-1 h-3 w-3" />
          Load
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
            onClick={() => onDelete(layout.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}

export function CallSheetLayoutDialog({
  open,
  onOpenChange,
  currentSections,
  onApplyLayout,
}: CallSheetLayoutDialogProps) {
  const [savedLayouts, setSavedLayouts] = useState<readonly CallSheetLayout[]>(() =>
    loadSavedLayouts(),
  )
  const [newLayoutName, setNewLayoutName] = useState("")

  const handleLoad = useCallback(
    (layout: CallSheetLayout) => {
      onApplyLayout(layout.sectionVisibility)
      toast.success(`Layout "${layout.name}" applied`)
      onOpenChange(false)
    },
    [onApplyLayout, onOpenChange],
  )

  const handleDelete = useCallback((id: string) => {
    const next = deleteLayout(id)
    setSavedLayouts(next)
    toast.success("Layout deleted")
  }, [])

  const handleSave = useCallback(() => {
    const trimmed = newLayoutName.trim()
    if (!trimmed) {
      toast.error("Enter a layout name")
      return
    }
    const layout = createLayout(trimmed, currentSections)
    const next = saveLayout(layout)
    setSavedLayouts(next)
    setNewLayoutName("")
    toast.success(`Layout "${trimmed}" saved`)
  }, [newLayoutName, currentSections])

  // Refresh saved layouts when dialog opens
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setSavedLayouts(loadSavedLayouts())
      }
      onOpenChange(next)
    },
    [onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Layout Templates</DialogTitle>
          <DialogDescription>
            Save and load section visibility presets.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="builtin">
          <TabsList className="w-full">
            <TabsTrigger value="builtin" className="flex-1">
              Built-in
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex-1">
              Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builtin" className="flex flex-col gap-2">
            {BUILTIN_LAYOUTS.map((layout) => (
              <LayoutRow
                key={layout.id}
                layout={layout}
                onLoad={handleLoad}
              />
            ))}
          </TabsContent>

          <TabsContent value="saved" className="flex flex-col gap-3">
            {/* Save current layout */}
            <div className="flex flex-col gap-2 rounded-md border border-dashed border-[var(--color-border)] p-3">
              <Label
                htmlFor="layout-name"
                className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                Save Current Layout
              </Label>
              <div className="flex gap-2">
                <Input
                  id="layout-name"
                  placeholder="Layout name..."
                  value={newLayoutName}
                  onChange={(e) => setNewLayoutName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave()
                  }}
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={!newLayoutName.trim()}
                >
                  Save
                </Button>
              </div>
              <VisibilityPreview visibility={currentSections} />
            </div>

            {/* Saved layout list */}
            {savedLayouts.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
                No saved layouts yet. Save your current configuration above.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {savedLayouts.map((layout) => (
                  <LayoutRow
                    key={layout.id}
                    layout={layout}
                    onLoad={handleLoad}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
