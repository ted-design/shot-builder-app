import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { Button } from "@/ui/button"
import { useProductFamilyDoc, useProductSkuDoc } from "@/features/shots/hooks/usePickerData"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { ExternalLink } from "lucide-react"
import type { ProductAssignment } from "@/shared/types"

function QuickViewImage({ src, alt }: { readonly src: string | undefined; readonly alt: string }) {
  const resolved = useStorageUrl(src)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  if (!resolved || errored) {
    return (
      <div className="flex h-[120px] w-full items-center justify-center rounded-md bg-[var(--color-surface-subtle)] text-xs text-[var(--color-text-subtle)]">
        No image
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className="h-[120px] w-full rounded-md border border-[var(--color-border)] object-contain bg-[var(--color-surface-subtle)]"
      onError={() => setErrored(true)}
    />
  )
}

function QuickViewContent({ assignment }: { readonly assignment: ProductAssignment }) {
  const needsLookup = !assignment.thumbUrl && !assignment.skuImageUrl && !assignment.familyImageUrl
  const familyIdForLookup =
    needsLookup && assignment.familyId ? assignment.familyId : assignment.familyId

  const { data: family } = useProductFamilyDoc(familyIdForLookup ?? null)
  // Legacy/colour-keyed assignments carry the SKU doc id in colourId, not
  // skuId (mirrors ProductAssignmentPicker's lookup) — fall back so the
  // per-SKU launch date still resolves for them.
  const { data: sku } = useProductSkuDoc(
    assignment.familyId ?? null,
    assignment.skuId ?? assignment.colourId ?? null,
  )

  const imageSrc =
    assignment.thumbUrl ??
    assignment.skuImageUrl ??
    assignment.familyImageUrl ??
    family?.thumbnailImagePath ??
    family?.headerImagePath

  const familyName = assignment.familyName ?? family?.styleName ?? assignment.familyId
  const colourName = assignment.colourName ?? assignment.skuName
  const styleNumber = family?.styleNumbers?.[0] ?? family?.styleNumber

  // Per-SKU launch date wins; otherwise fall back to the family date and mark
  // the value as inherited so the UI can show a quiet badge.
  const familyLaunch = family?.earliestLaunchDate ?? family?.launchDate ?? null
  const resolvedLaunch = sku?.launchDate ?? familyLaunch
  const launchInherited = !sku?.launchDate && !!familyLaunch
  const launchDate = formatDateOnly(resolvedLaunch)

  const sampleCount = family?.sampleCount

  return (
    <div className="flex flex-col gap-3 p-3">
      <QuickViewImage src={imageSrc} alt={familyName} />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--color-text)] leading-tight">{familyName}</p>
        {styleNumber && (
          <p className="font-mono text-2xs text-[var(--color-text-subtle)]">{styleNumber}</p>
        )}
        {colourName && (
          <p className="text-xs text-[var(--color-text-secondary)]">{colourName}</p>
        )}
      </div>

      {(launchDate || sampleCount != null) && (
        <div className="flex flex-col gap-0.5">
          {launchDate && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-[var(--color-text-subtle)]">Launch</span>
              <span className="flex items-center gap-1 text-2xs text-[var(--color-text-secondary)]">
                {launchDate}
                {launchInherited && (
                  <span
                    className="rounded-sm bg-[var(--color-surface-subtle)] px-1 text-2xs text-[var(--color-text-subtle)]"
                    title="Inherited from the product family"
                  >
                    inherited
                  </span>
                )}
              </span>
            </div>
          )}
          {sampleCount != null && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs text-[var(--color-text-subtle)]">Samples</span>
              <span className="text-2xs text-[var(--color-text-secondary)]">{sampleCount}</span>
            </div>
          )}
        </div>
      )}

      <Link
        to={`/products/${assignment.familyId}`}
        className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        Open product page
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  )
}

export function ProductQuickViewPopover({
  assignment,
  children,
}: {
  readonly assignment: ProductAssignment
  readonly children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-[220px] p-0"
      >
        {open && <QuickViewContent assignment={assignment} />}
      </PopoverContent>
    </Popover>
  )
}
