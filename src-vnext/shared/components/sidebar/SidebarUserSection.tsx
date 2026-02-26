import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { Button } from "@/ui/button"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/app/providers/AuthProvider"
import { toast } from "sonner"

interface SidebarUserSectionProps {
  readonly collapsed: boolean
}

export function SidebarUserSection({ collapsed }: SidebarUserSectionProps) {
  const { user, signOut } = useAuth()

  return (
    <div className="mt-auto border-t border-[var(--color-sidebar-border)] p-3">
      <div
        className={cn(
          "flex items-center gap-3 rounded-md px-2 py-2",
          collapsed && "justify-center gap-0 px-0",
        )}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={user?.photoURL ?? undefined} />
          <AvatarFallback className="bg-[var(--color-sidebar-active)] text-xs font-semibold text-[var(--color-sidebar-text-active)]">
            {user?.displayName?.charAt(0) ?? "?"}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-sidebar-text-active)]">
                {user?.displayName ?? user?.email ?? "User"}
              </p>
              <p className="truncate text-xs text-[var(--color-sidebar-text)]">
                {user?.email ?? ""}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text-active)]"
              onClick={() => { signOut().catch(() => toast.error("Failed to sign out. Try again.")) }}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
