import { LogOut, Loader2 } from "lucide-react"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"

interface PendingAccessPageProps {
  readonly error?: string | null
}

export function PendingAccessPage({ error }: PendingAccessPageProps) {
  const { signOut, claimingInvitation } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-bg)] p-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="heading-page">
          Production Hub
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {claimingInvitation ? "Checking for invitation\u2026" : "Waiting for access"}
        </p>
      </div>

      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {claimingInvitation ? (
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
        ) : error ? (
          <p className="text-sm text-[var(--color-error)]">{error}</p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            Your account has been created. An administrator needs to grant you
            access before you can use the app.
          </p>
        )}

        {!claimingInvitation && (
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        )}
      </div>
    </div>
  )
}
