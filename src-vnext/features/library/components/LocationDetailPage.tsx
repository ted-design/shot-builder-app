import { useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { locationDocPath } from "@/shared/lib/paths"
import { mapLocationRecord } from "@/features/schedules/lib/mapSchedule"
import { canManageLocations } from "@/shared/lib/rbac"
import {
  updateLocation,
  deleteLocation,
  uploadLocationPhoto,
  removeLocationPhoto,
} from "@/features/library/lib/locationWrites"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import { Camera, Phone, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function LocationDetailPage() {
  const { locationId } = useParams<{ locationId: string }>()
  const navigate = useNavigate()
  const { clientId, role, user } = useAuth()

  const { data: location, loading, error } = useFirestoreDoc(
    clientId && locationId ? locationDocPath(locationId, clientId) : null,
    mapLocationRecord,
  )

  const isMobile = useIsMobile()
  const canEdit = !isMobile && canManageLocations(role)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removePhotoOpen, setRemovePhotoOpen] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [notesEditing, setNotesEditing] = useState(false)
  const [notesDraft, setNotesDraft] = useState("")

  if (loading) return <LoadingState loading skeleton={<DetailPageSkeleton />} />

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Failed to load location.
        </p>
      </div>
    )
  }

  if (!location) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Location not found.
        </p>
      </div>
    )
  }

  const handleFieldSave = (field: string, value: string) => {
    if (!clientId || !locationId) return
    const trimmed = value.trim()
    void updateLocation({
      clientId,
      userId: user?.uid ?? null,
      locationId,
      patch: { [field]: trimmed || null },
    }).catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update field.")
    })
  }

  const handleNotesSave = () => {
    setNotesEditing(false)
    const trimmed = notesDraft.trim()
    if (trimmed === (location.notes ?? "")) return
    handleFieldSave("notes", trimmed)
  }

  const handlePhotoSelect = async (file: File) => {
    if (!clientId || !locationId) return
    setUploading(true)
    try {
      const uploaded = await uploadLocationPhoto({
        clientId,
        locationId,
        file,
        previousPath: location.photoPath,
      })
      await updateLocation({
        clientId,
        userId: user?.uid ?? null,
        locationId,
        patch: { photoPath: uploaded.path, photoUrl: uploaded.url },
      })
      toast.success("Photo updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo.")
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.currentTarget.value = ""
    if (!file) return
    void handlePhotoSelect(file)
  }

  const handleRemovePhoto = async () => {
    if (!clientId || !locationId) return
    setRemovingPhoto(true)
    try {
      await removeLocationPhoto({
        clientId,
        userId: user?.uid ?? null,
        locationId,
        photoPath: location.photoPath,
      })
      toast.success("Photo removed.")
      setRemovePhotoOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo.")
    } finally {
      setRemovingPhoto(false)
    }
  }

  const handleDelete = () => {
    if (!clientId || !locationId) return
    setDeleting(true)
    void deleteLocation({
      clientId,
      locationId,
      photoPath: location.photoPath,
    })
      .then(() => {
        toast.success("Location deleted.")
        navigate("/library/locations")
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to delete location.")
      })
      .finally(() => setDeleting(false))
  }

  const enterNotesEdit = () => {
    setNotesDraft(location.notes ?? "")
    setNotesEditing(true)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <PageHeader
        title={location.name}
        breadcrumbs={[
          { label: "Library" },
          { label: "Locations", to: "/library/locations" },
        ]}
      />

      {/* Photo section */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {location.photoUrl ? (
        <div className="relative">
          <img
            src={location.photoUrl}
            alt={location.name}
            className="w-full max-h-60 rounded-lg object-cover"
          />
          {canEdit && (
            <div className="absolute bottom-2 right-2 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={uploading || removingPhoto}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Uploading..." : "Change"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={uploading || removingPhoto}
                onClick={() => setRemovePhotoOpen(true)}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                {removingPhoto ? "Removing..." : "Remove"}
              </Button>
            </div>
          )}
        </div>
      ) : canEdit ? (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-border)] py-10 text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-text-subtle)] hover:text-[var(--color-text-secondary)]"
        >
          <Camera className="h-8 w-8" />
          <span className="text-sm">
            {uploading ? "Uploading..." : "Click to upload photo"}
          </span>
        </button>
      ) : null}

      {/* Address section */}
      <Card>
        <CardContent className="p-4">
          <h2 className="heading-subsection pb-3">Address</h2>
          <div className="space-y-3">
            <AddressField
              label="Street"
              value={location.street ?? ""}
              canEdit={canEdit}
              onSave={(v) => handleFieldSave("street", v)}
            />
            <AddressField
              label="Unit / Suite"
              value={location.unit ?? ""}
              canEdit={canEdit}
              onSave={(v) => handleFieldSave("unit", v)}
            />
            <AddressField
              label="City"
              value={location.city ?? ""}
              canEdit={canEdit}
              onSave={(v) => handleFieldSave("city", v)}
            />
            <AddressField
              label="Province / State"
              value={location.province ?? ""}
              canEdit={canEdit}
              onSave={(v) => handleFieldSave("province", v)}
            />
            <AddressField
              label="Postal / ZIP"
              value={location.postal ?? ""}
              canEdit={canEdit}
              onSave={(v) => handleFieldSave("postal", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Phone section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
            <div className="flex-1">
              <span className="label-meta">Phone</span>
              <InlineEdit
                value={location.phone ?? ""}
                placeholder="Add phone number"
                onSave={(v) => handleFieldSave("phone", v)}
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes section */}
      <Card>
        <CardContent className="p-4">
          <h2 className="heading-subsection pb-3">Notes</h2>
          {notesEditing ? (
            <Textarea
              autoFocus
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={handleNotesSave}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setNotesEditing(false)
                }
              }}
              rows={4}
              className="resize-none"
            />
          ) : (
            <div
              className={
                canEdit
                  ? "cursor-pointer rounded px-1 py-1 transition-colors hover:bg-[var(--color-surface-subtle)]"
                  : ""
              }
              onClick={() => {
                if (canEdit) enterNotesEdit()
              }}
            >
              {location.notes ? (
                <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                  {location.notes}
                </p>
              ) : (
                <p className="text-sm text-[var(--color-text-subtle)]">
                  {canEdit ? "Click to add notes..." : "No notes"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete button */}
      {canEdit && (
        <div className="pt-2">
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            disabled={deleting}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete location"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={removePhotoOpen}
        onOpenChange={setRemovePhotoOpen}
        title="Remove photo"
        description="Are you sure you want to remove this photo? This action cannot be undone."
        confirmLabel="Remove"
        destructive
        confirmDisabled={removingPhoto}
        onConfirm={handleRemovePhoto}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete location"
        description={`Are you sure you want to delete "${location.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        confirmDisabled={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function AddressField({
  label,
  value,
  canEdit,
  onSave,
}: {
  readonly label: string
  readonly value: string
  readonly canEdit: boolean
  readonly onSave: (value: string) => void
}) {
  return (
    <div>
      <span className="label-meta">{label}</span>
      <InlineEdit
        value={value}
        placeholder="—"
        onSave={onSave}
        disabled={!canEdit}
      />
    </div>
  )
}
