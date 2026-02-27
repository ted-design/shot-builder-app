import { useState, useMemo } from "react"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import { Badge } from "@/ui/badge"
import { bulkCreateSkus } from "@/features/products/lib/productWrites"
import { toast } from "@/shared/hooks/use-toast"

function parseColorwayNames(raw: string): ReadonlyArray<string> {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

interface BulkCreateColorwaysDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly clientId: string | null
  readonly userId: string | null
  readonly familyId: string
  readonly existingColorNames: ReadonlyArray<string>
  readonly familySizes: ReadonlyArray<string>
}

export function BulkCreateColorwaysDialog({
  open,
  onOpenChange,
  clientId,
  userId,
  familyId,
  existingColorNames,
  familySizes,
}: BulkCreateColorwaysDialogProps) {
  const [raw, setRaw] = useState("")
  const [saving, setSaving] = useState(false)

  const parsed = useMemo(() => parseColorwayNames(raw), [raw])
  const existingSet = useMemo(
    () => new Set(existingColorNames.map((n) => n.toLowerCase())),
    [existingColorNames],
  )
  const newNames = useMemo(
    () => [...new Set(parsed.filter((n) => !existingSet.has(n.toLowerCase())))],
    [parsed, existingSet],
  )
  const duplicateCount = parsed.length - newNames.length

  const handleSave = async () => {
    if (newNames.length === 0 || !clientId) return
    setSaving(true)
    try {
      const count = await bulkCreateSkus({
        clientId,
        userId,
        familyId,
        colorNames: newNames,
        existingColorNames,
        familySizes,
      })
      toast({
        title: "Colorways created",
        description: `${count} colorway${count === 1 ? "" : "s"} added.`,
      })
      setRaw("")
      onOpenChange(false)
    } catch (err) {
      toast({
        title: "Failed to create colorways",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setRaw("")
    }
    onOpenChange(next)
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Quick add colorways"
      description="Enter colorway names separated by commas or line breaks."
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || newNames.length === 0 || !clientId || !userId}
          >
            {saving ? "Creating..." : `Add ${newNames.length} colorway${newNames.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"Forest Green\nOxblood\nNavy\nCharcoal"}
          className="min-h-[120px] bg-[var(--color-surface)]"
          disabled={saving}
          autoFocus
        />
        {parsed.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>{parsed.length} parsed</span>
            {duplicateCount > 0 && (
              <Badge variant="outline" className="text-2xs">
                {duplicateCount} already exist
              </Badge>
            )}
            {newNames.length > 0 && (
              <Badge variant="outline" className="text-2xs">
                {newNames.length} new
              </Badge>
            )}
          </div>
        )}
        {newNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {newNames.map((name) => (
              <Badge key={name} variant="secondary" className="text-xxs">
                {name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
