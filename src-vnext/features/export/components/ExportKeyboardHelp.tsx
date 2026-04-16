import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog"

interface ExportKeyboardHelpProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

interface ShortcutEntry {
  readonly keys: string
  readonly description: string
}

const SHORTCUTS: readonly ShortcutEntry[] = [
  { keys: "⌘ /", description: "Insert block at cursor" },
  { keys: "Delete", description: "Remove selected block" },
  { keys: "Esc", description: "Deselect block" },
  { keys: "?", description: "Show this help" },
]

function ShortcutRow({ entry }: { readonly entry: ShortcutEntry }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-[var(--color-text)]">{entry.description}</span>
      <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 font-mono text-xs text-[var(--color-text-muted)]">
        {entry.keys}
      </kbd>
    </div>
  )
}

export function ExportKeyboardHelp({ open, onOpenChange }: ExportKeyboardHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts available in the export builder.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-[var(--color-border)]">
          {SHORTCUTS.map((entry) => (
            <ShortcutRow key={entry.keys} entry={entry} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
