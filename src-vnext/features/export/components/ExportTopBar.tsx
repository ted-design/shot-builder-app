import { useState, useRef, useEffect } from "react"
import {
  ChevronDown,
  FileText,
  Settings,
  Braces,
  Download,
  Plus,
  Check,
  Trash2,
} from "lucide-react"
import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import type { ExportReport } from "../hooks/useExportReports"

const ZOOM_OPTIONS = [50, 75, 100, 125, 150] as const

interface ExportTopBarProps {
  readonly documentName: string
  readonly pageCount: number
  readonly zoom: number
  readonly onAddPage: () => void
  readonly onZoomChange: (zoom: number) => void
  readonly onOpenTemplates: () => void
  readonly onOpenVariables: () => void
  readonly onOpenPageSettings: () => void
  readonly onExport: () => void
  readonly reports?: readonly ExportReport[]
  readonly activeReportId?: string | null
  readonly onSelectReport?: (reportId: string) => void
  readonly onCreateReport?: () => void
  readonly onRenameReport?: (name: string) => void
  readonly onDeleteReport?: (reportId: string) => void
}

function InlineRenameInput({
  value,
  onCommit,
}: {
  readonly value: string
  readonly onCommit: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing) {
      inputRef.current?.select()
    }
  }, [editing])

  if (!editing) {
    return (
      <button
        type="button"
        className="truncate max-w-[180px] text-sm text-[var(--color-text)] hover:underline cursor-text"
        onDoubleClick={() => setEditing(true)}
        title="Double-click to rename"
      >
        {value}
      </button>
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        const trimmed = draft.trim()
        if (trimmed.length > 0 && trimmed !== value) {
          onCommit(trimmed)
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur()
        } else if (e.key === "Escape") {
          setDraft(value)
          setEditing(false)
        }
      }}
      className="h-7 w-[180px] rounded border border-[var(--color-border-hover)] bg-[var(--color-surface)] px-1.5 text-sm text-[var(--color-text)] outline-none"
    />
  )
}

export function ExportTopBar({
  documentName,
  pageCount,
  zoom,
  onAddPage,
  onZoomChange,
  onOpenTemplates,
  onOpenVariables,
  onOpenPageSettings,
  onExport,
  reports,
  activeReportId,
  onSelectReport,
  onCreateReport,
  onRenameReport,
  onDeleteReport,
}: ExportTopBarProps) {
  const hasReports = reports && reports.length > 0

  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <div className="flex items-center gap-3">
        {/* Report name + dropdown */}
        <div className="flex items-center gap-1">
          {onRenameReport ? (
            <InlineRenameInput value={documentName} onCommit={onRenameReport} />
          ) : (
            <span className="truncate max-w-[180px] text-sm text-[var(--color-text)]">
              {documentName}
            </span>
          )}

          {hasReports && onSelectReport ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center rounded-md p-1 hover:bg-[var(--color-surface-muted)] transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {reports.map((report) => (
                  <DropdownMenuItem
                    key={report.id}
                    onClick={() => onSelectReport(report.id)}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{report.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {report.id === activeReportId && (
                        <Check className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                      )}
                      {onDeleteReport && report.id !== activeReportId && (
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteReport(report.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
                {onCreateReport && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onCreateReport}>
                      <Plus className="h-3.5 w-3.5" />
                      New Report
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          )}
        </div>

        <div className="flex items-center gap-1.5 border-l border-[var(--color-border)] pl-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {pageCount} {pageCount === 1 ? "page" : "pages"}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddPage}>
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only">Add page</span>
          </Button>
        </div>

        <div className="flex items-center border-l border-[var(--color-border)] pl-3">
          <select
            value={zoom}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="h-6 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-xs text-[var(--color-text-muted)] outline-none focus:border-[var(--color-border-hover)]"
          >
            {ZOOM_OPTIONS.map((z) => (
              <option key={z} value={z}>
                {z}%
              </option>
            ))}
          </select>
        </div>
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
