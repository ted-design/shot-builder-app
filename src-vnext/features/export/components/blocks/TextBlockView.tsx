import { useState, useCallback, useRef, useEffect } from "react"
import type { TextBlock, ExportVariable } from "../../types/exportBuilder"
import { sanitizeHtml } from "@/shared/lib/sanitizeHtml"
import { FloatingTextToolbar } from "../FloatingTextToolbar"
import { deriveTextSpec } from "../../lib/blockSpec"
import { renderBlockSpecDom } from "../../lib/specAdapters/dom"

interface TextBlockViewProps {
  readonly block: TextBlock
  readonly variables: readonly ExportVariable[]
  readonly onUpdateBlock?: (
    blockId: string,
    updates: Partial<TextBlock>,
  ) => void
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[c] ?? c,
  )
}

const PDF_RENDER_TIME_TOKENS = new Set(["pageNumber", "pageCount"])

/** Replace {{variableKey}} tokens with styled chip spans for the edit surface. */
function renderContentWithChips(
  content: string,
  variables: readonly ExportVariable[],
): string {
  const variableMap = new Map(variables.map((v) => [v.key, v]))
  return content.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const variable = variableMap.get(key)
    const safeKey = escapeHtml(key)
    const safeLabel = escapeHtml(variable?.label ?? key)
    const isResolved = variable !== undefined || PDF_RENDER_TIME_TOKENS.has(key)
    const chipClass = isResolved
      ? "inline-flex items-center rounded bg-[var(--color-accent-subtle)] px-1.5 text-xs text-[var(--color-accent)]"
      : "inline-flex items-center rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 text-xs text-amber-700 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-700"
    return `<span class="${chipClass}" data-token="${safeKey}" contenteditable="false" ${!isResolved ? 'title="Undefined variable"' : ""}>${safeLabel}</span>`
  })
}

/** Strip chip spans back to raw {{key}} tokens */
function stripChipsToTokens(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  const chips = doc.querySelectorAll("[data-token]")
  for (const chip of chips) {
    const key = chip.getAttribute("data-token") ?? ""
    const textNode = doc.createTextNode(`{{${key}}}`)
    chip.parentNode?.replaceChild(textNode, chip)
  }
  return doc.body.innerHTML
}

export function TextBlockView({
  block,
  variables,
  onUpdateBlock,
}: TextBlockViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const editableRef = useRef<HTMLDivElement>(null)

  // Display renders from the shared spec (resolved variables, WYSIWYG-to-PDF).
  const spec = deriveTextSpec(block, { variables })
  const t = spec.typography

  const handleDoubleClick = useCallback(() => {
    if (!onUpdateBlock) return
    setIsEditing(true)
  }, [onUpdateBlock])

  const handleBlur = useCallback(() => {
    if (!editableRef.current || !onUpdateBlock) return

    const rawHtml = editableRef.current.innerHTML
    const withTokens = stripChipsToTokens(rawHtml)
    const sanitized = sanitizeHtml(withTokens)

    onUpdateBlock(block.id, { content: sanitized })
    setIsEditing(false)
    setToolbarPosition(null)
  }, [block.id, onUpdateBlock])

  const handleFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value)
  }, [])

  // Listen for selection changes while editing to position toolbar
  useEffect(() => {
    if (!isEditing) return

    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setToolbarPosition(null)
        return
      }

      // Only show toolbar if selection is within our editable div
      const anchorNode = selection.anchorNode
      if (!editableRef.current || !anchorNode) return
      if (!editableRef.current.contains(anchorNode)) {
        setToolbarPosition(null)
        return
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setToolbarPosition({
        top: rect.top - 40,
        left: rect.left + rect.width / 2,
      })
    }

    document.addEventListener("selectionchange", handleSelectionChange)
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange)
    }
  }, [isEditing])

  // Focus the editable div when entering edit mode
  useEffect(() => {
    if (isEditing && editableRef.current) {
      editableRef.current.focus()
    }
  }, [isEditing])

  // Edit surface mirrors the spec typography so editing looks like display.
  const editBaseStyle: React.CSSProperties = {
    fontSize: `${String(t.fontSizePx)}px`,
    fontWeight: t.fontWeight,
    textAlign: t.textAlign,
    color: t.color,
    fontFamily: t.fontFamily,
    lineHeight: t.lineHeight,
    minHeight: "1.5em",
    backgroundColor: t.highlightColor,
  }

  if (isEditing) {
    const editContent = block.content
      ? renderContentWithChips(sanitizeHtml(block.content), variables)
      : ""

    return (
      <>
        <FloatingTextToolbar
          position={toolbarPosition}
          onFormat={handleFormat}
        />
        <div
          ref={editableRef}
          data-testid="text-block-editable"
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          style={{
            ...editBaseStyle,
            outline: "none",
            cursor: "text",
          }}
          className="rounded ring-1 ring-[var(--color-accent)] ring-offset-1"
          dangerouslySetInnerHTML={{ __html: editContent }}
        />
      </>
    )
  }

  return (
    <div
      data-testid="text-block"
      onDoubleClick={handleDoubleClick}
      style={{ cursor: onUpdateBlock ? "pointer" : "default" }}
    >
      {spec.isEmpty ? (
        <span className="text-[var(--color-text-subtle)] italic">
          Double-click to add text...
        </span>
      ) : (
        renderBlockSpecDom(spec)
      )}
    </div>
  )
}
