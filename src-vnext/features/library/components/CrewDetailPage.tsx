import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  Briefcase,
  Building2,
  Mail,
  Phone,
  Trash2,
  User,
} from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { crewDocPath } from "@/shared/lib/paths"
import { canManageCrew } from "@/shared/lib/rbac"
import { mapCrewRecord } from "@/features/schedules/lib/mapSchedule"
import { updateCrewMember, deleteCrewMember } from "@/features/library/lib/crewWrites"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { Card, CardContent } from "@/ui/card"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"
import type { Role } from "@/shared/types"

interface FieldRowProps {
  readonly icon: React.ReactNode
  readonly label: string
  readonly value: string | null | undefined
  readonly editable?: boolean
  readonly disabled?: boolean
  readonly onSave?: (value: string) => void
}

function FieldRow({ icon, label, value, editable, disabled, onSave }: FieldRowProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 text-[var(--color-text-muted)]">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="label-meta mb-0.5">{label}</p>
        {editable && onSave && !disabled ? (
          <InlineEdit
            value={value ?? ""}
            onSave={onSave}
            placeholder="Click to edit"
          />
        ) : (
          <p className={value ? "text-sm text-[var(--color-text)]" : "text-sm text-[var(--color-text-subtle)]"}>
            {value || "\u2014"}
          </p>
        )}
      </div>
    </div>
  )
}

function NotesSection({
  notes,
  canEdit,
  onSave,
}: {
  readonly notes: string | undefined
  readonly canEdit: boolean
  readonly onSave: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(notes ?? "")

  const handleSave = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== (notes ?? "")) {
      onSave(trimmed)
    }
  }

  if (editing) {
    return (
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(notes ?? "")
            setEditing(false)
          }
        }}
        autoFocus
        rows={4}
        className="rounded-lg"
      />
    )
  }

  return (
    <div
      className={
        canEdit
          ? "min-h-[80px] cursor-pointer rounded-lg border border-[var(--color-border)] p-3 text-sm transition-colors hover:bg-[var(--color-surface-subtle)]"
          : "min-h-[80px] rounded-lg border border-[var(--color-border)] p-3 text-sm"
      }
      onClick={() => {
        if (canEdit) {
          setDraft(notes ?? "")
          setEditing(true)
        }
      }}
    >
      {notes ? (
        <p className="whitespace-pre-wrap text-[var(--color-text)]">{notes}</p>
      ) : (
        <p className="text-[var(--color-text-subtle)]">
          {canEdit ? "Click to add notes..." : "No notes"}
        </p>
      )}
    </div>
  )
}

export default function CrewDetailPage() {
  const { crewId } = useParams<{ crewId: string }>()
  const navigate = useNavigate()
  const { user, clientId, role } = useAuth()

  const { data: crew, loading } = useFirestoreDoc(
    clientId && crewId ? crewDocPath(crewId, clientId) : null,
    mapCrewRecord,
  )

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isMobile = useIsMobile()
  const canEdit = !isMobile && canManageCrew(role as Role)

  const handleFieldSave = async (field: string, value: string) => {
    if (!clientId || !crewId) return
    try {
      await updateCrewMember({
        clientId,
        userId: user?.uid ?? null,
        crewId,
        patch: { [field]: value.trim() || null },
      })
      toast.success("Crew member updated")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update"
      toast.error(message)
    }
  }

  const handleDelete = async () => {
    if (!clientId || !crewId) return
    setDeleting(true)
    try {
      await deleteCrewMember({ clientId, crewId })
      toast.success("Crew member deleted")
      navigate("/library/crew", { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete"
      toast.error(message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <LoadingState loading skeleton={<DetailPageSkeleton />} />
      </div>
    )
  }

  if (!crew) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">Crew member not found</p>
          <Link
            to="/library/crew"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            Back to Crew
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={crew.name}
        breadcrumbs={[
          { label: "Library" },
          { label: "Crew", to: "/library/crew" },
        ]}
      />

      {/* Info section */}
      <Card className="rounded-lg">
        <CardContent className="p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <FieldRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={crew.email}
              editable
              disabled={!canEdit}
              onSave={(v) => handleFieldSave("email", v)}
            />
            <FieldRow
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={crew.phone}
              editable
              disabled={!canEdit}
              onSave={(v) => handleFieldSave("phone", v)}
            />
            <FieldRow
              icon={<Building2 className="h-4 w-4" />}
              label="Company"
              value={crew.company}
              editable
              disabled={!canEdit}
              onSave={(v) => handleFieldSave("company", v)}
            />
            <FieldRow
              icon={<Briefcase className="h-4 w-4" />}
              label="Department"
              value={crew.department}
            />
            <FieldRow
              icon={<User className="h-4 w-4" />}
              label="Position"
              value={crew.position}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notes section */}
      <div className="mt-6">
        <h2 className="heading-section mb-2">Notes</h2>
        <NotesSection
          notes={crew.notes}
          canEdit={canEdit}
          onSave={(v) => handleFieldSave("notes", v)}
        />
      </div>

      {/* Delete */}
      {canEdit && (
        <div className="mt-8 border-t border-[var(--color-border)] pt-6">
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete crew member
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete crew member"
        description={`Are you sure you want to delete ${crew.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        confirmDisabled={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
