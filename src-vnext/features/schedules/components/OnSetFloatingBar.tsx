import { PenLine, Flag } from "lucide-react"
import { toast } from "sonner"

export function OnSetFloatingBar() {
  function handleAddNote() {
    toast.info("Note saved.")
  }

  function handleFlagIssue() {
    toast.info("Issue flagged.")
  }

  return (
    <div
      className="absolute left-3 right-3"
      style={{ bottom: 34, zIndex: 20 }}
    >
      <div
        className="rounded-2xl border border-[var(--color-border)] px-2 py-2 flex items-center justify-around gap-1"
        style={{
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          /* Frosted glass effect — intentional static white for light-mode mobile surface */
          background: "rgba(255,255,255,0.82)",
          boxShadow: "0 -2px 20px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.06)",
        }}
      >
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-2 min-h-[44px] transition-all active:scale-95 active:opacity-80"
          style={{ minWidth: 72 }}
          onClick={handleAddNote}
        >
          <PenLine className="w-5 h-5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
          <span className="text-3xs font-medium text-[var(--color-text-muted)]">Add Note</span>
        </button>

        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-2 min-h-[44px] transition-all active:scale-95 active:opacity-80"
          style={{ minWidth: 72 }}
          onClick={handleFlagIssue}
        >
          <Flag className="w-5 h-5 text-[var(--color-text-muted)]" strokeWidth={1.5} />
          <span className="text-3xs font-medium text-[var(--color-text-muted)]">Flag Issue</span>
        </button>
      </div>
    </div>
  )
}
