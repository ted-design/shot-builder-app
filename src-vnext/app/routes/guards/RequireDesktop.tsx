import { useEffect, useRef } from "react"
import { Navigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { useIsDesktop } from "@/shared/hooks/useMediaQuery"

interface RequireDesktopProps {
  readonly children: React.ReactNode
  readonly label: string
}

export function RequireDesktop({ children, label }: RequireDesktopProps) {
  const isDesktop = useIsDesktop()
  const { id: projectId } = useParams<{ id: string }>()
  const toastShown = useRef(false)

  useEffect(() => {
    if (!isDesktop && !toastShown.current) {
      toastShown.current = true
      toast.info(`${label} is available on desktop.`)
    }
  }, [isDesktop, label])

  if (!isDesktop) {
    const redirectTo = projectId ? `/projects/${projectId}/shots` : "/projects"
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
