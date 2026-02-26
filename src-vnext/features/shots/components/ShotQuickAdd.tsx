import { useRef, useState } from "react"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotsPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { createShotVersionSnapshot } from "@/features/shots/lib/shotVersioning"
import { computeMaxShotNumber, formatShotNumber } from "@/features/shots/lib/shotNumbering"
import { ShotBatchCreate } from "@/features/shots/components/ShotBatchCreate"
import { ClipboardList, Plus } from "lucide-react"
import { toast } from "sonner"
import type { Shot } from "@/shared/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShotQuickAddProps {
  /** All shots in the project — used to compute the next shot number. */
  readonly shots: ReadonlyArray<Shot>
  /** Called after a shot is successfully created. */
  readonly onCreated?: (shotId: string, title: string) => void
  /** When true, reduces padding and hides keyboard hints for narrow containers. */
  readonly compact?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotQuickAdd({ shots, onCreated, compact = false }: ShotQuickAddProps) {
  const { clientId, user } = useAuth()
  const { projectId } = useProjectScope()
  const inputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchCreating, setBatchCreating] = useState(false)

  // N shortcut focuses the input (ignored when already in an input/textarea)
  useKeyboardShortcuts([
    { key: "n", handler: () => inputRef.current?.focus() },
  ])

  // Shared shot creation logic — returns the new doc ID
  const createShot = async (
    shotTitle: string,
    shotNumber: string,
  ): Promise<string> => {
    const path = shotsPath(clientId!)
    const createdBy = user?.uid ?? ""
    const sortOrder = Date.now()

    const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
      title: shotTitle,
      description: null,
      projectId,
      clientId,
      status: "todo",
      talent: [],
      products: [],
      sortOrder,
      shotNumber,
      date: null,
      deleted: false,
      notes: null,
      referenceLinks: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy,
    })

    // Fire-and-forget version snapshot
    if (user?.uid) {
      void createShotVersionSnapshot({
        clientId: clientId!,
        shotId: ref.id,
        previousShot: null,
        patch: {
          title: shotTitle,
          description: null,
          status: "todo",
          talent: [],
          products: [],
          sortOrder,
          shotNumber,
          deleted: false,
          notes: null,
          notesAddendum: null,
          date: null,
          locationId: null,
          locationName: null,
          heroImage: null,
          looks: null,
          activeLookId: null,
          tags: null,
          referenceLinks: [],
          laneId: null,
        },
        user,
        changeType: "create",
      }).catch(() => {
        // Version snapshot is non-critical; swallow errors
      })
    }

    return ref.id
  }

  // ---- Single shot creation ----

  const handleCreate = async () => {
    const trimmed = title.trim()
    if (!trimmed || creating) return

    if (!clientId) {
      toast.error("Missing client scope")
      return
    }

    setCreating(true)

    try {
      const max = computeMaxShotNumber(shots)
      const shotNumber = formatShotNumber(max + 1)
      const shotId = await createShot(trimmed, shotNumber)

      setTitle("")
      inputRef.current?.focus()
      onCreated?.(shotId, trimmed)
    } catch (err) {
      toast.error("Failed to create shot", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setCreating(false)
    }
  }

  // ---- Batch shot creation ----

  const handleBatchCreate = async (titles: readonly string[]) => {
    if (!clientId) {
      toast.error("Missing client scope")
      return
    }

    setBatchCreating(true)

    try {
      const baseMax = computeMaxShotNumber(shots)
      let created = 0

      for (let i = 0; i < titles.length; i++) {
        const shotNumber = formatShotNumber(baseMax + i + 1)
        const shotId = await createShot(titles[i]!, shotNumber)
        created++
        onCreated?.(shotId, titles[i]!)
      }

      setBatchOpen(false)
      toast.success(`Created ${created} shots`)
    } catch (err) {
      toast.error("Failed to create shots", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBatchCreating(false)
    }
  }

  // ---- Key handling ----

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      void handleCreate()
    }
    if (e.key === "Escape") {
      setTitle("")
      inputRef.current?.blur()
    }
  }

  return (
    <div className={compact ? "relative" : "relative mb-4"}>
      <ShotBatchCreate
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onBatchCreate={handleBatchCreate}
        creating={batchCreating}
      >
        <div
          className={
            compact
              ? "flex items-center gap-1.5 rounded-md border bg-[var(--color-surface)] px-2 py-1.5 " +
                "border-[var(--color-border)] transition-all duration-150 " +
                "focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_2px_rgba(24,24,27,0.08)]"
              : "flex items-center gap-2 rounded-[10px] border bg-[var(--color-surface)] px-3.5 py-2.5 " +
                "border-[var(--color-border)] transition-all duration-150 " +
                "focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_2px_rgba(24,24,27,0.08)]"
          }
        >
          <Plus className={compact ? "h-4 w-4 flex-shrink-0 text-[var(--color-text-subtle)]" : "h-5 w-5 flex-shrink-0 text-[var(--color-text-subtle)]"} />

          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={compact ? "New shot title..." : "New shot title... (press Enter to create)"}
            disabled={creating}
            className={compact
              ? "flex-1 min-w-0 bg-transparent text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none disabled:opacity-50"
              : "flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none disabled:opacity-50"
            }
          />

          {!compact && (
            <div className="hidden flex-shrink-0 items-center gap-1 text-2xs text-[var(--color-text-subtle)] sm:flex">
              <kbd className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] px-1.5 text-3xs font-medium text-[var(--color-text-muted)]">
                N
              </kbd>
              <span>to focus</span>
              <span className="mx-1 text-[var(--color-border-strong)]">|</span>
              <button
                type="button"
                onClick={() => setBatchOpen(true)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Batch paste
              </button>
            </div>
          )}
        </div>
      </ShotBatchCreate>
    </div>
  )
}
