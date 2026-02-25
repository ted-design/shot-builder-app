import type { ViewMode, ShotsListFields } from "@/features/shots/lib/shotListFilters"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/ui/sheet"
import { Checkbox } from "@/ui/checkbox"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ShotListDisplaySheetProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly isMobile: boolean
  readonly viewMode: ViewMode
  readonly fields: ShotsListFields
  readonly onFieldsChange: (fields: ShotsListFields) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FieldToggle({
  label,
  checked,
  onToggle,
}: {
  readonly label: string
  readonly checked: boolean
  readonly onToggle: () => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => {
          if (v === "indeterminate") return
          onToggle()
        }}
      />
      <span>{label}</span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotListDisplaySheet({
  open,
  onOpenChange,
  isMobile,
  viewMode,
  fields,
  onFieldsChange,
}: ShotListDisplaySheetProps) {
  const toggle = (key: keyof ShotsListFields) =>
    onFieldsChange({ ...fields, [key]: !fields[key] })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Display</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {viewMode !== "table" && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Presets
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onFieldsChange({
                      ...fields,
                      heroThumb: true,
                      shotNumber: true,
                      description: false,
                      notes: false,
                      readiness: true,
                      tags: true,
                      location: false,
                      products: false,
                      links: false,
                      talent: false,
                    })
                  }
                >
                  Storyboard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onFieldsChange({
                      ...fields,
                      heroThumb: true,
                      shotNumber: true,
                      description: true,
                      notes: true,
                      readiness: true,
                      tags: true,
                      location: true,
                      products: true,
                      links: true,
                      talent: true,
                    })
                  }
                >
                  Prep
                </Button>
              </div>
            </div>
          )}

          {viewMode === "visual" ? (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Visual View
              </div>
              <div className="space-y-2">
                <FieldToggle label="Shot number" checked={fields.shotNumber} onToggle={() => toggle("shotNumber")} />
                <FieldToggle label="Tags" checked={fields.tags} onToggle={() => toggle("tags")} />
                <FieldToggle label="Notes" checked={fields.notes} onToggle={() => toggle("notes")} />
                <FieldToggle label="Reference links" checked={fields.links} onToggle={() => toggle("links")} />
                <p className="text-xs text-[var(--color-text-muted)]">
                  Visual view always shows the hero image.
                </p>
              </div>
            </div>
          ) : viewMode === "table" ? (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Table Columns
              </div>
              <div className="space-y-2">
                <FieldToggle label="Hero thumbnail" checked={fields.heroThumb} onToggle={() => toggle("heroThumb")} />
                <FieldToggle label="Shot number" checked={fields.shotNumber} onToggle={() => toggle("shotNumber")} />
                <FieldToggle label="Description preview" checked={fields.description} onToggle={() => toggle("description")} />
                <FieldToggle label="Notes preview" checked={fields.notes} onToggle={() => toggle("notes")} />
                <FieldToggle label="Date" checked={fields.date} onToggle={() => toggle("date")} />
                <FieldToggle label="Location" checked={fields.location} onToggle={() => toggle("location")} />
                <FieldToggle label="Products" checked={fields.products} onToggle={() => toggle("products")} />
                <FieldToggle label="Reference links" checked={fields.links} onToggle={() => toggle("links")} />
                <FieldToggle label="Talent" checked={fields.talent} onToggle={() => toggle("talent")} />
                <FieldToggle label="Tags" checked={fields.tags} onToggle={() => toggle("tags")} />
                <FieldToggle label="Updated" checked={fields.updated} onToggle={() => toggle("updated")} />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Cards
                </div>
                <div className="space-y-2">
                  <FieldToggle label="Hero thumbnail" checked={fields.heroThumb} onToggle={() => toggle("heroThumb")} />
                  <FieldToggle label="Shot number" checked={fields.shotNumber} onToggle={() => toggle("shotNumber")} />
                  <FieldToggle label="Description preview" checked={fields.description} onToggle={() => toggle("description")} />
                  <FieldToggle label="Notes preview" checked={fields.notes} onToggle={() => toggle("notes")} />
                  <FieldToggle label="Readiness indicators" checked={fields.readiness} onToggle={() => toggle("readiness")} />
                  <FieldToggle label="Tags" checked={fields.tags} onToggle={() => toggle("tags")} />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Details
                </div>
                <div className="space-y-2">
                  <FieldToggle label="Location" checked={fields.location} onToggle={() => toggle("location")} />
                  <FieldToggle label="Products" checked={fields.products} onToggle={() => toggle("products")} />
                  <FieldToggle label="Reference links" checked={fields.links} onToggle={() => toggle("links")} />
                  <FieldToggle label="Talent" checked={fields.talent} onToggle={() => toggle("talent")} />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <SheetClose asChild>
              <Button size="sm">Done</Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
