import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Role } from "@/shared/types"
import { useAuth } from "@/app/providers/AuthProvider"

// 5e-III: In-memory "View as" preview. A GLOBAL admin/producer can preview the
// Crew (Shoot) surface without persisting anything. NO localStorage, NO URL,
// NO resolvedRoleCache commit, NO toast — React state ONLY. The preview only
// NARROWS the presentation surface; real write-gates keep using the real role.
interface ViewAsPreviewContextValue {
  readonly previewRole: Role | null // null = not previewing; at 5e only ever "crew" or null
  readonly setPreviewRole: (role: Role | null) => void
  readonly clearPreview: () => void
}

const ViewAsPreviewContext = createContext<ViewAsPreviewContextValue>({
  previewRole: null,
  setPreviewRole: () => {},
  clearPreview: () => {},
})

export function ViewAsPreviewProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const { user, role } = useAuth()
  const [previewRole, setPreviewRole] = useState<Role | null>(null)

  // 5e-III: clearing the preview returns the user to their real view.
  const clearPreview = useCallback(() => setPreviewRole(null), [])

  // 5e-III: reset the in-memory preview when the signed-in identity or global
  // role changes (an in-place sign-out/sign-in, or a mid-session claim change).
  // Otherwise a stale 'crew' preview strands the next, lower-privilege user in
  // the narrowed shell with no visible control to exit. Reset only — not a
  // persistence write.
  useEffect(() => {
    setPreviewRole(null)
  }, [user?.uid, role])

  const value = useMemo<ViewAsPreviewContextValue>(
    () => ({ previewRole, setPreviewRole, clearPreview }),
    [previewRole, clearPreview],
  )

  return (
    <ViewAsPreviewContext.Provider value={value}>
      {children}
    </ViewAsPreviewContext.Provider>
  )
}

export function useViewAsPreview(): ViewAsPreviewContextValue {
  return useContext(ViewAsPreviewContext)
}
