import { ChevronDown, FileText, Settings, Braces, Download } from "lucide-react"
import { Button } from "@/ui/button"

interface ExportTopBarProps {
  readonly documentName: string
  readonly onOpenTemplates: () => void
  readonly onOpenVariables: () => void
  readonly onOpenPageSettings: () => void
  readonly onExport: () => void
}

export function ExportTopBar({
  documentName,
  onOpenTemplates,
  onOpenVariables,
  onOpenPageSettings,
  onExport,
}: ExportTopBarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] transition-colors"
        >
          <span className="truncate max-w-[180px]">{documentName}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onOpenTemplates}>
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Templates</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenVariables}>
          <Braces className="h-4 w-4" />
          <span className="hidden sm:inline">Variables</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenPageSettings}>
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Page Settings</span>
        </Button>
        <Button size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>
    </div>
  )
}
