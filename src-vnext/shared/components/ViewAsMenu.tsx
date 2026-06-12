import { Eye } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useViewAsPreview } from "@/app/providers/ViewAsPreviewProvider"
import { isFeatureEnabled } from "@/shared/lib/flags"
import { ROLE } from "@/shared/lib/rbac"
import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"

// 5e-III: the QUIET "View as" menu. A passive, GLOBAL-claim-only affordance that
// lets an admin/producer PREVIEW the Crew (Shoot) surface without persisting
// anything. Consumes the in-memory ViewAsPreviewProvider ONLY — no localStorage,
// no URL, no navigation, no resolvedRoleCache, no toast. The preview NARROWS the
// presentation surface; every real write-gate keeps using the real role.
export function ViewAsMenu() {
  // 5e-III gate: the WHOLE 5e initiative lives behind featureShootSurface
  // (default OFF in prod). Render nothing unless the flag is on.
  const shootSurfaceEnabled = isFeatureEnabled("featureShootSurface")

  // 5e-III: gate on the GLOBAL claim from useAuth (admin/producer), NOT the
  // effective role — this affordance is the global-claim privilege to preview,
  // distinct from useEffectiveRole. Never route preview through that hook.
  const { role } = useAuth()
  const isGlobalAdminOrProducer =
    role === ROLE.ADMIN || role === ROLE.PRODUCER

  const { previewRole, setPreviewRole, clearPreview } = useViewAsPreview()

  // Quiet: passive admin/producer-only affordance, only when the flag is on.
  if (!shootSurfaceEnabled || !isGlobalAdminOrProducer) return null

  const isPreviewing = previewRole !== null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          data-testid="view-as-trigger"
        >
          <Eye className="h-4 w-4" />
          {isPreviewing ? "Previewing as Crew" : "View as"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>View as</DropdownMenuLabel>
        {/* 5e-III scope: ONLY "Crew (Shoot)". setPreviewRole is in-memory state
            on the provider — no persistence side-effects. */}
        <DropdownMenuItem
          data-testid="view-as-crew"
          onSelect={() => setPreviewRole(ROLE.CREW)}
        >
          Crew (Shoot)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* 5e-III: "Return to your view" clears the in-memory preview. Enabled
            only while previewing — clearPreview is a no-op otherwise. */}
        <DropdownMenuItem
          data-testid="view-as-return"
          disabled={!isPreviewing}
          onSelect={() => {
            if (isPreviewing) clearPreview()
          }}
        >
          Return to your view
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
