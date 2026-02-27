import { useState } from "react"
import type { ProductFamily, ProductDocument } from "@/shared/types"
import { LoadingState } from "@/shared/components/LoadingState"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { ProductImage } from "@/features/products/components/ProductImage"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import {
  createProductDocument,
  deleteProductDocument,
} from "@/features/products/lib/productWorkspaceWrites"
import { formatDateTime, formatBytes } from "@/features/products/lib/productDetailHelpers"
import { toast } from "@/shared/hooks/use-toast"
import { Button } from "@/ui/button"
import { Card, CardContent } from "@/ui/card"
import { cn } from "@/shared/lib/utils"
import { Download, FileText, Plus, Trash2, Upload } from "lucide-react"

interface ImageEntry {
  readonly key: string
  readonly label: string
  readonly path: string
}

interface ProductAssetsSectionProps {
  readonly family: ProductFamily
  readonly familyImages: ReadonlyArray<ImageEntry>
  readonly skuImages: ReadonlyArray<ImageEntry>
  readonly documents: ReadonlyArray<ProductDocument>
  readonly documentsLoading: boolean
  readonly documentsError: { message: string } | null
  readonly canEdit: boolean
  readonly clientId: string | null
  readonly userId: string | null
  readonly userName: string | null
  readonly userAvatar: string | null
  readonly isFamilyDeleted: boolean
  readonly assetsCount: number
}

export function ProductAssetsSection({
  family,
  familyImages,
  skuImages,
  documents,
  documentsLoading,
  documentsError,
  canEdit,
  clientId,
  userId,
  userName,
  userAvatar,
  isFamilyDeleted,
  assetsCount,
}: ProductAssetsSectionProps) {
  const [uploading, setUploading] = useState(false)
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<ProductDocument | null>(null)

  const visibleDocuments = documents.filter(isDocumentUsable)

  const handleUpload = (file: File) => {
    if (!clientId || !userId) return
    setUploading(true)
    void createProductDocument({
      clientId,
      familyId: family.id,
      userId,
      userName,
      userAvatar,
      file,
    })
      .then(() => toast({ title: "Uploaded", description: "Document uploaded." }))
      .catch((err) => {
        toast({
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Failed to upload document.",
        })
      })
      .finally(() => setUploading(false))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Assets</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Photos and supporting documents attached to this product.
          </p>
        </div>
        {canEdit && !isFamilyDeleted && (
          <label
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium text-[var(--color-text)] shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              (uploading || !clientId) && "pointer-events-none opacity-50",
            )}
          >
            <Upload className="h-4 w-4" />
            Upload document
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={uploading || !clientId}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.currentTarget.value = ""
                if (file) handleUpload(file)
              }}
            />
          </label>
        )}
      </div>

      {assetsCount === 0 ? (
        <InlineEmpty
          icon={<FileText className="h-8 w-8" />}
          title="No assets"
          description="No images or documents are currently attached to this product."
          action={
            canEdit && !isFamilyDeleted ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-[var(--color-text)] shadow-sm transition-colors hover:bg-accent">
                <Plus className="h-4 w-4" />
                Upload document
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  disabled={uploading || !clientId}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.currentTarget.value = ""
                    if (file) handleUpload(file)
                  }}
                />
              </label>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="label-meta">Documents</div>
            {documentsError && (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
                {documentsError.message}
              </div>
            )}
            {documentsLoading ? (
              <LoadingState loading />
            ) : visibleDocuments.length === 0 ? (
              <InlineEmpty
                icon={<FileText className="h-8 w-8" />}
                title="No documents"
                description="No documents uploaded yet."
                action={
                  canEdit && !isFamilyDeleted ? (
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-[var(--color-text)] shadow-sm transition-colors hover:bg-accent">
                      <Plus className="h-4 w-4" />
                      Upload
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        disabled={uploading || !clientId}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.currentTarget.value = ""
                          if (file) handleUpload(file)
                        }}
                      />
                    </label>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-2">
                {visibleDocuments.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    canEdit={canEdit && !isFamilyDeleted}
                    deleting={mutatingId === doc.id}
                    onDelete={(target) => {
                      setDocToDelete(target)
                      setDeleteConfirmOpen(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {familyImages.length > 0 && (
            <ImageGrid label="Family images" images={familyImages} />
          )}

          {skuImages.length > 0 && (
            <ImageGrid label="Colorway images" images={skuImages} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete document?"
        description="This removes the metadata and attempts to delete the file from storage."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!clientId || !docToDelete) return
          setDeleteConfirmOpen(false)
          setMutatingId(docToDelete.id)
          void deleteProductDocument({
            clientId,
            familyId: family.id,
            documentId: docToDelete.id,
            storagePath: docToDelete.storagePath,
          })
            .then(() => toast({ title: "Deleted", description: "Document deleted." }))
            .catch((err) => {
              toast({
                title: "Delete failed",
                description: err instanceof Error ? err.message : "Failed to delete document.",
              })
            })
            .finally(() => {
              setMutatingId(null)
              setDocToDelete(null)
            })
        }}
      />
    </div>
  )
}

function isDocumentUsable(doc: ProductDocument): boolean {
  return doc.deleted !== true && typeof doc.storagePath === "string" && doc.storagePath.trim().length > 0
}

function DocumentRow({
  doc,
  canEdit,
  deleting = false,
  onDelete,
}: {
  readonly doc: ProductDocument
  readonly canEdit: boolean
  readonly deleting?: boolean
  readonly onDelete: (doc: ProductDocument) => void
}) {
  const url = useStorageUrl(doc.storagePath)
  const uploadedAt = formatDateTime(doc.createdAt)
  const who = doc.createdByName ?? (doc.createdBy ? "Member" : "—")

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[var(--color-text)]">{doc.name}</div>
        <div className="truncate text-xs text-[var(--color-text-muted)]">
          {who} · {uploadedAt} · {formatBytes(doc.sizeBytes)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-9" disabled={!url || deleting} asChild>
          <a href={url ?? "#"} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" />
            Download
          </a>
        </Button>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-[var(--color-error)] hover:text-[var(--color-error)]"
            disabled={deleting}
            onClick={() => onDelete(doc)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

function ImageGrid({ label, images }: { readonly label: string; readonly images: ReadonlyArray<ImageEntry> }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="label-meta">{label}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => (
          <Card key={img.key}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <ProductImage src={img.path} alt={img.label} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--color-text)]">{img.label}</div>
                  <div className="truncate text-xs text-[var(--color-text-muted)]">{img.path}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
