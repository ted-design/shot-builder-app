import { useCallback, useMemo, useRef } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { useShot } from "@/features/shots/hooks/useShot"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { canManageShots } from "@/shared/lib/rbac"
import { LoadingState } from "@/shared/components/LoadingState"
import { ThreePanelListPanel } from "@/features/shots/components/ThreePanelListPanel"
import { ThreePanelCanvasPanel } from "@/features/shots/components/ThreePanelCanvasPanel"
import { ThreePanelPropertiesPanel } from "@/features/shots/components/ThreePanelPropertiesPanel"
import { toast } from "sonner"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "sb:three-panel:sizes"

const STATUS_CYCLE: ReadonlyArray<ShotFirestoreStatus> = [
  "todo",
  "in_progress",
  "on_hold",
  "complete",
]

function loadSavedSizes(): readonly [number, number, number] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as number[]
    if (Array.isArray(parsed) && parsed.length === 3) {
      return parsed as unknown as [number, number, number]
    }
  } catch {
    // ignore
  }
  return null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThreePanelLayoutProps {
  readonly selectedShotId: string
  readonly shots: ReadonlyArray<Shot>
  readonly allShots: ReadonlyArray<Shot>
  readonly showCreate: boolean
  readonly onDeselect: () => void
  readonly onSelectShot: (shotId: string) => void
  readonly onShotCreated?: (shotId: string, title: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreePanelLayout({
  selectedShotId,
  shots,
  allShots,
  showCreate,
  onDeselect,
  onSelectShot,
  onShotCreated,
}: ThreePanelLayoutProps) {
  const { data: shot, loading, error } = useShot(selectedShotId)
  const { role, clientId, user } = useAuth()
  const isMobile = useIsMobile()

  const canEdit = canManageShots(role) && !isMobile
  const canDoOperational = canManageShots(role)

  // -- Save function (same pattern as ShotDetailPage) --
  const save = useCallback(
    async (fields: Record<string, unknown>): Promise<boolean> => {
      if (!shot || !clientId) return false
      try {
        await updateShotWithVersion({
          clientId,
          shotId: shot.id,
          patch: fields,
          shot,
          user,
          source: "ThreePanelLayout",
        })
        return true
      } catch {
        toast.error("Failed to save changes")
        return false
      }
    },
    [shot, clientId, user],
  )

  // -- Prev/next shot navigation --
  const currentIndex = useMemo(
    () => shots.findIndex((s) => s.id === selectedShotId),
    [shots, selectedShotId],
  )

  const navigatePrev = useCallback(() => {
    if (currentIndex > 0) {
      onSelectShot(shots[currentIndex - 1]!.id)
    }
  }, [currentIndex, shots, onSelectShot])

  const navigateNext = useCallback(() => {
    if (currentIndex < shots.length - 1) {
      onSelectShot(shots[currentIndex + 1]!.id)
    }
  }, [currentIndex, shots, onSelectShot])

  // -- Status change via 1-4 keys --
  const handleStatusKey = useCallback(
    (index: number) => {
      if (!shot || !clientId) return
      const newStatus = STATUS_CYCLE[index]
      if (!newStatus || shot.status === newStatus) return
      void updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: { status: newStatus },
        shot,
        user,
        source: "ThreePanelLayout:keyboard",
      }).catch(() => {
        toast.error("Failed to update status")
      })
    },
    [shot, clientId, user],
  )

  // -- Toggle-deselect: clicking the selected shot deselects --
  const handleSelectOrDeselect = useCallback(
    (shotId: string) => {
      if (shotId === selectedShotId) {
        onDeselect()
      } else {
        onSelectShot(shotId)
      }
    },
    [selectedShotId, onDeselect, onSelectShot],
  )

  // -- Keyboard shortcuts --
  useKeyboardShortcuts([
    { key: "Escape", handler: onDeselect },
    { key: "[", handler: navigatePrev },
    { key: "]", handler: navigateNext },
    { key: "1", handler: () => handleStatusKey(0) },
    { key: "2", handler: () => handleStatusKey(1) },
    { key: "3", handler: () => handleStatusKey(2) },
    { key: "4", handler: () => handleStatusKey(3) },
  ])

  // -- Panel size persistence --
  const savedSizes = useMemo(() => loadSavedSizes(), [])

  const handleLayout = useCallback((sizes: number[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
    } catch {
      // quota exceeded — ignore
    }
  }, [])

  // -- Center panel content --
  const renderCenter = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <LoadingState loading />
        </div>
      )
    }
    if (error) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        </div>
      )
    }
    if (!shot) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <p className="text-sm text-[var(--color-text-muted)]">Shot not found.</p>
        </div>
      )
    }
    return (
      <ThreePanelCanvasPanel
        shot={shot}
        save={save}
        canEdit={canEdit}
        canDoOperational={canDoOperational}
        onClose={onDeselect}
      />
    )
  }

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-var(--header-height))]">
      <PanelGroup
        direction="horizontal"
        onLayout={handleLayout}
      >
        <Panel
          defaultSize={savedSizes?.[0] ?? 22}
          minSize={15}
          maxSize={35}
          order={1}
        >
          <ThreePanelListPanel
            shots={shots}
            allShots={allShots}
            selectedShotId={selectedShotId}
            onSelectShot={handleSelectOrDeselect}
            showCreate={showCreate}
            onShotCreated={onShotCreated}
          />
        </Panel>

        <PanelResizeHandle className="w-px bg-[var(--color-border)] transition-colors hover:bg-[var(--color-primary)] data-[resize-handle-active]:bg-[var(--color-primary)]" />

        <Panel
          defaultSize={savedSizes?.[1] ?? 52}
          minSize={30}
          order={2}
        >
          {renderCenter()}
        </Panel>

        <PanelResizeHandle className="w-px bg-[var(--color-border)] transition-colors hover:bg-[var(--color-primary)] data-[resize-handle-active]:bg-[var(--color-primary)]" />

        <Panel
          defaultSize={savedSizes?.[2] ?? 26}
          minSize={18}
          maxSize={40}
          order={3}
        >
          {shot ? (
            <ThreePanelPropertiesPanel
              shot={shot}
              save={save}
              canEdit={canEdit}
              canDoOperational={canDoOperational}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4">
              <p className="text-xs text-[var(--color-text-muted)]">
                Select a shot to view properties
              </p>
            </div>
          )}
        </Panel>
      </PanelGroup>
    </div>
  )
}
