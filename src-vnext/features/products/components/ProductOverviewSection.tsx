import { useMemo } from "react"
import type { ProductFamily, ProductSku, ProductSample, ProductComment, ProductDocument } from "@/shared/types"
import { Card, CardContent } from "@/ui/card"
import { cn } from "@/shared/lib/utils"
import {
  ActivityIcon,
  Box,
  FileText,
  Palette,
} from "lucide-react"
import { humanizeClassificationKey } from "@/features/products/lib/productClassifications"
import { normalizeNotesSnippet } from "@/features/products/lib/productDetailHelpers"
import type { ProductWorkspaceSectionKey } from "@/features/products/components/ProductWorkspaceNav"

interface ProductOverviewSectionProps {
  readonly family: ProductFamily
  readonly activeSkus: ReadonlyArray<ProductSku>
  readonly visibleSamples: ReadonlyArray<ProductSample>
  readonly visibleComments: ReadonlyArray<ProductComment>
  readonly visibleDocuments: ReadonlyArray<ProductDocument>
  readonly skuPhotosCount: number
  readonly assetsCount: number
  readonly imageAssetsCount: number
  readonly onSectionChange: (key: ProductWorkspaceSectionKey) => void
}

export function ProductOverviewSection({
  family,
  activeSkus,
  visibleSamples,
  visibleComments,
  visibleDocuments,
  skuPhotosCount,
  assetsCount,
  imageAssetsCount,
  onSectionChange,
}: ProductOverviewSectionProps) {
  const notesSnippet = useMemo(() => normalizeNotesSnippet(family.notes), [family.notes])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Explore sections</h3>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Colorways, samples, assets, and activity—organized for fast scanning under pressure.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <OverviewCard
          icon={<Palette className="h-4 w-4" />}
          title="Colorways"
          description="Manage SKUs, sizes, and photos."
          metric={activeSkus.length}
          metricSub={`${skuPhotosCount} with photos`}
          onClick={() => onSectionChange("colorways")}
        />
        <OverviewCard
          icon={<Box className="h-4 w-4" />}
          title="Samples"
          description="Track requests, transit, arrivals, and issues."
          metric={visibleSamples.length}
          metricSub="tracked"
          onClick={() => onSectionChange("samples")}
        />
        <OverviewCard
          icon={<FileText className="h-4 w-4" />}
          title="Assets"
          description="Photos plus supporting documents (tech packs, specs)."
          metric={assetsCount}
          metricSub={`${imageAssetsCount} images · ${visibleDocuments.length} docs`}
          onClick={() => onSectionChange("assets")}
        />
        <OverviewCard
          icon={<ActivityIcon className="h-4 w-4" />}
          title="Activity"
          description="Discussion thread and recent changes."
          metric={visibleComments.length}
          metricSub="comments"
          onClick={() => onSectionChange("activity")}
        />
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="label-meta">Classification</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <ClassificationField label="Gender" value={family.gender} />
          <ClassificationField label="Type" value={family.productType} />
          <ClassificationField label="Subcategory" value={family.productSubcategory} />
        </div>
        {notesSnippet && (
          <div className="mt-3 rounded-md bg-[var(--color-surface-subtle)] p-3">
            <div className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">Notes</div>
            <div className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">{notesSnippet}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function OverviewCard({
  icon,
  title,
  description,
  metric,
  metricSub,
  onClick,
}: {
  readonly icon: React.ReactNode
  readonly title: string
  readonly description: string
  readonly metric: number
  readonly metricSub: string
  readonly onClick: () => void
}) {
  return (
    <Card
      className={cn("cursor-pointer transition-shadow hover:shadow-md")}
      onClick={onClick}
      role="button"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-[var(--color-surface-subtle)] p-2 text-[var(--color-text-muted)]">
              {icon}
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{description}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-[var(--color-text)]">{metric}</div>
            <div className="text-xs text-[var(--color-text-muted)]">{metricSub}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ClassificationField({ label, value }: { readonly label: string; readonly value?: string | null }) {
  return (
    <div>
      <div className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">{label}</div>
      <div className="mt-0.5 text-sm text-[var(--color-text)]">
        {value ? humanizeClassificationKey(value) : "—"}
      </div>
    </div>
  )
}
