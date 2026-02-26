import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KeyboardShortcutsDialogProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

type ShortcutEntry = {
  readonly keys: ReadonlyArray<string>
  readonly description: string
}

type ShortcutGroup = {
  readonly title: string
  readonly shortcuts: ReadonlyArray<ShortcutEntry>
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const SHORTCUT_GROUPS: ReadonlyArray<ShortcutGroup> = [
  {
    title: "Shot List",
    shortcuts: [
      { keys: ["N"], description: "Focus quick-add input" },
      { keys: ["1"], description: "Gallery view" },
      { keys: ["2"], description: "Visual view" },
      { keys: ["3"], description: "Table view" },
      { keys: ["4"], description: "Board view" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Shot Detail",
    shortcuts: [
      { keys: ["Escape"], description: "Return to shot list" },
      { keys: ["\u2318", "S"], description: "Prevent browser save (auto-save active)" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["["], description: "Toggle sidebar" },
    ],
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Kbd({ children }: { readonly children: string }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 font-mono text-2xs text-[var(--color-text-subtle)]">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-[var(--color-text)]">{shortcut.description}</span>
                    <span className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
