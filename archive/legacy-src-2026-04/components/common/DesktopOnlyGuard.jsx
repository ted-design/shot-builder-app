import { useNavigate } from "react-router-dom";
import { Monitor } from "lucide-react";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Button } from "../ui/button";

/**
 * DesktopOnlyGuard — blocks rendering on mobile viewports.
 *
 * Wraps a desktop-only page and replaces its content with a calm
 * interstitial when the viewport is below the md breakpoint (768px).
 *
 * Usage:
 *   <DesktopOnlyGuard surface="Shot Editor">
 *     <ShotEditorPageContent />
 *   </DesktopOnlyGuard>
 *
 * The `surface` prop appears in the subtitle so the user knows
 * which feature requires a larger screen.
 */
export default function DesktopOnlyGuard({ children, surface = "This feature" }) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (!isMobile) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4 mb-5">
        <Monitor className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Best on desktop
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-6">
        {surface} requires a larger screen for the best experience.
      </p>
      <Button variant="outline" onClick={() => navigate(-1)}>
        Go back
      </Button>
    </div>
  );
}
