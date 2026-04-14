/**
 * Demo Mode Banner
 *
 * Displays a small banner at the top of the page when demo mode is active.
 * Shows a message indicating changes won't be saved and provides an exit button.
 */

import { X } from "lucide-react";
import { isDemoModeActive, setDemoModeOverride } from "../lib/flags";

export default function DemoModeBanner() {
  if (!isDemoModeActive()) {
    return null;
  }

  const handleExitDemo = () => {
    // Clear the demo mode flag
    setDemoModeOverride(null);
    // Redirect to login page (full page reload to clear all state)
    window.location.href = "/login";
  };

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>
        Demo Mode — Changes won&apos;t be saved
      </span>
      <button
        onClick={handleExitDemo}
        className="inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
      >
        <X className="h-3 w-3" />
        Exit Demo
      </button>
    </div>
  );
}
