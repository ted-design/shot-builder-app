import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { useIsDesktop } from "@/shared/hooks/useMediaQuery"
import { Button } from "@/ui/button"
import { Plus, Camera, StickyNote, X } from "lucide-react"

interface FabAction {
  readonly label: string
  readonly icon: React.ComponentType<{ className?: string }>
  readonly param: string
  readonly value: string
}

const SHOT_LIST_ACTIONS: readonly FabAction[] = [
  { label: "New Shot", icon: Plus, param: "create", value: "1" },
]

const SHOT_DETAIL_ACTIONS: readonly FabAction[] = [
  { label: "Mark Shot", icon: Camera, param: "status_picker", value: "1" },
  { label: "Add Note", icon: StickyNote, param: "focus", value: "notes" },
]

function getActionsForRoute(pathname: string): readonly FabAction[] {
  // /projects/:id/shots/:sid — shot detail
  if (/^\/projects\/[^/]+\/shots\/[^/]+$/.test(pathname)) {
    return SHOT_DETAIL_ACTIONS
  }
  // /projects/:id/shots — shot list
  if (/^\/projects\/[^/]+\/shots\/?$/.test(pathname)) {
    return SHOT_LIST_ACTIONS
  }
  return []
}

export function FloatingActionBar() {
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  const [, setSearchParams] = useSearchParams()
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(true)
  const lastScrollY = useRef(0)

  const actions = getActionsForRoute(pathname)

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      if (y > lastScrollY.current + 10) {
        setVisible(false)
        setExpanded(false)
      } else if (y < lastScrollY.current - 10) {
        setVisible(true)
      }
      lastScrollY.current = y
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Close expanded on route change
  useEffect(() => {
    setExpanded(false)
  }, [pathname])

  const handleAction = useCallback(
    (action: FabAction) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(action.param, action.value)
          return next
        },
        { replace: true },
      )
      setExpanded(false)
    },
    [setSearchParams],
  )

  // Don't render on desktop, public pages, or routes with no actions
  if (isDesktop || actions.length === 0) return null

  const singleAction = actions.length === 1

  return (
    <div
      className={`fixed bottom-6 right-4 z-50 flex flex-col items-end gap-2 transition-transform duration-200 pb-[env(safe-area-inset-bottom)] ${
        visible ? "translate-y-0" : "translate-y-[calc(100%+2rem)]"
      }`}
      data-testid="fab"
    >
      {/* Expanded actions */}
      {expanded && !singleAction && (
        <div className="flex flex-col items-end gap-2">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.param}
                className="touch-target gap-2 rounded-full shadow-lg"
                onClick={() => handleAction(action)}
                data-testid={`fab-action-${action.param}`}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </Button>
            )
          })}
        </div>
      )}

      {/* Main FAB button */}
      {singleAction ? (
        <Button
          size="lg"
          className="h-14 w-14 touch-target rounded-full shadow-lg"
          onClick={() => handleAction(actions[0]!)}
          aria-label={actions[0]!.label}
          data-testid="fab-main"
        >
          <Plus className="h-6 w-6" />
        </Button>
      ) : (
        <Button
          size="lg"
          className="h-14 w-14 touch-target rounded-full shadow-lg"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? "Close actions" : "Open actions"}
          data-testid="fab-main"
        >
          {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      )}
    </div>
  )
}
