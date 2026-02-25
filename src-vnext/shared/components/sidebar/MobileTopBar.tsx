import { Menu } from "lucide-react"
import { Button } from "@/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsTablet } from "@/shared/hooks/useMediaQuery"

interface MobileTopBarProps {
  readonly onMenuOpen: () => void
  readonly projectName?: string
}

export function MobileTopBar({ onMenuOpen, projectName }: MobileTopBarProps) {
  const { user } = useAuth()
  const isTablet = useIsTablet()

  return (
    <header className="fixed inset-x-0 top-0 z-[var(--z-fixed)] flex h-[var(--topbar-height)] items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2"
          onClick={onMenuOpen}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {isTablet && projectName ? (
          <div className="text-sm text-neutral-500">
            <span className="text-neutral-400">{projectName}</span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-[var(--color-text)]">
            {projectName ?? "Shot Builder"}
          </span>
        )}
      </div>
      <Avatar className="h-8 w-8">
        <AvatarImage src={user?.photoURL ?? undefined} />
        <AvatarFallback className="bg-neutral-700 text-xs font-semibold text-white">
          {user?.displayName?.charAt(0) ?? "?"}
        </AvatarFallback>
      </Avatar>
    </header>
  )
}
