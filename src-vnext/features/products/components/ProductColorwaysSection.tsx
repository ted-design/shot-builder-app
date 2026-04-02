import { useState } from "react"
import type { AuthUser, ProductFamily, ProductSku } from "@/shared/types"
import { LoadingState } from "@/shared/components/LoadingState"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { ProductSkuCard } from "@/features/products/components/ProductSkuCard"
import { EditableProductImage } from "@/features/products/components/EditableProductImage"
import { BulkCreateColorwaysDialog } from "@/features/products/components/BulkCreateColorwaysDialog"
import { replaceProductFamilyImage } from "@/features/products/lib/productWorkspaceWrites"
import { updateDoc, doc } from "firebase/firestore"
import { deleteObject, ref as storageRef } from "firebase/storage"
import { db, storage } from "@/shared/lib/firebase"
import { productFamiliesPath } from "@/shared/lib/paths"
import { toast } from "@/shared/hooks/use-toast"
import { Button } from "@/ui/button"
import { Palette, Pencil, Plus } from "lucide-react"

interface ProductColorwaysSectionProps {
  readonly family: ProductFamily
  readonly skuLoading: boolean
  readonly activeSkus: ReadonlyArray<ProductSku>
  readonly visibleSkus: ReadonlyArray<ProductSku>
  readonly canEdit: boolean
  readonly isFamilyDeleted: boolean
  readonly clientId: string | null
  readonly userId: string | null
  readonly user?: AuthUser
  readonly onAddColorway?: () => void
}

export function ProductColorwaysSection({
  family,
  skuLoading,
  activeSkus,
  visibleSkus,
  canEdit,
  isFamilyDeleted,
  clientId,
  userId,
  user,
  onAddColorway,
}: ProductColorwaysSectionProps) {
  const [bulkOpen, setBulkOpen] = useState(false)
  const existingColorNames = activeSkus.map((s) => s.colorName ?? s.name ?? "").filter(Boolean)
  const editEnabled = canEdit && !isFamilyDeleted && !!clientId

  const handleFamilyImageReplace = (file: File) => {
    if (!clientId) return
    void replaceProductFamilyImage({
      clientId,
      familyId: family.id,
      userId,
      imageType: "thumbnail",
      file,
      previousImagePath: family.thumbnailImagePath,
    }).catch((err) => {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload image.",
      })
    })
  }

  const handleFamilyImageRemove = family.thumbnailImagePath
    ? () => {
        if (!clientId) return
        const previousPath = family.thumbnailImagePath
        const familyPath = productFamiliesPath(clientId)
        void updateDoc(doc(db, familyPath[0]!, ...familyPath.slice(1), family.id), {
          thumbnailImagePath: null,
          updatedAt: new Date(),
          updatedBy: userId,
        })
          .then(() => {
            if (previousPath) {
              return deleteObject(storageRef(storage, previousPath)).catch(() => {
                // Best-effort cleanup.
              })
            }
          })
          .catch((err) => {
            toast({
              title: "Remove failed",
              description: err instanceof Error ? err.message : "Failed to remove image.",
            })
          })
      }
    : undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Colorways</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            SKU-level status, sizing, and images.
          </p>
        </div>
        {canEdit && !isFamilyDeleted && activeSkus.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Plus className="h-4 w-4" />
            Quick add
          </Button>
        )}
      </div>

      {/* Family hero image */}
      <div className="flex justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <EditableProductImage
          src={family.thumbnailImagePath ?? family.headerImagePath}
          alt={family.styleName}
          size="lg"
          className="h-40 w-40"
          canEdit={editEnabled}
          onReplace={handleFamilyImageReplace}
          onRemove={handleFamilyImageRemove}
          label="Family Image"
        />
      </div>

      {skuLoading ? (
        <LoadingState loading />
      ) : activeSkus.length === 0 ? (
        <InlineEmpty
          icon={<Palette className="h-8 w-8" />}
          title="No colorways"
          description="This product family has no SKU colorways defined."
          action={
            canEdit && !isFamilyDeleted ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Quick add
                </Button>
                {onAddColorway && (
                  <Button type="button" variant="outline" size="sm" onClick={onAddColorway}>
                    <Pencil className="h-4 w-4" />
                    Full editor
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSkus.map((sku) => (
            <ProductSkuCard
              key={sku.id}
              sku={sku}
              familyImageUrl={family.thumbnailImagePath ?? family.headerImagePath}
              familyLaunchDate={family.launchDate}
              familySizeOptions={family.sizeOptions}
              canEdit={editEnabled}
              clientId={clientId}
              userId={userId}
              familyId={family.id}
              allSkus={activeSkus}
              family={family}
              user={user}
            />
          ))}
        </div>
      )}

      <BulkCreateColorwaysDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        clientId={clientId}
        userId={userId}
        familyId={family.id}
        existingColorNames={existingColorNames}
        familySizes={family.sizes ?? []}
      />
    </div>
  )
}
