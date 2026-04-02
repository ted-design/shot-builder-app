import { useState, useCallback, useRef, useEffect } from "react"
import type { TextBlock, ExportVariable } from "../../types/exportBuilder"
import { sanitizeHtml } from "@/shared/lib/sanitizeHtml"
import { FloatingTextToolbar } from "../FloatingTextToolbar"

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

/** Replace {{variableKey}} tokens with styled chip spans for display */
function renderContentWithChips(
  content: string,
  variables: readonly ExportVariable[],
): string {
  const variableMap = new Map(variables.map((v) => [v.key, v]))
  return content.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const variable = variableMap.get(key)
    const safeKey = escapeHtml(key)
    const safeLabel = escapeHtml(variable?.label ?? key)
    return `<span class="inline-flex items-center rounded bg-[var(--color-accent-subtle)] px-1.5 text-xs text-[var(--color-accent)]" data-token="${safeKey}" contenteditable="false">${safeLabel}</span>`
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

  const fontSize = block.typography?.fontSize ?? 14
  const textAlign = block.typography?.textAlign ?? "left"
  const fontColor = block.typography?.fontColor ?? "#000000"
  const fontFamily = block.typography?.fontFamily ?? "Inter"
  const highlightColor = block.typography?.highlightColor
  const blockType = block.typography?.blockType ?? "p"

  const blockTypeFontSize =
    blockType === "h1"
      ? 24
      : blockType === "h2"
        ? 20
        : blockType === "h3"
          ? 16
          : fontSize
  const blockTypeFontWeight =
    blockType === "h1" || blockType === "h2" || blockType === "h3"
      ? 700
      : undefined

  const isEmpty = !block.content

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

  const baseStyle: React.CSSProperties = {
    fontSize: `${String(blockTypeFontSize)}px`,
    fontWeight: blockTypeFontWeight,
    textAlign: textAlign as React.CSSProperties["textAlign"],
    color: fontColor,
    fontFamily,
    lineHeight: 1.5,
    minHeight: "1.5em",
    backgroundColor: highlightColor,
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
            ...baseStyle,
            outline: "none",
            cursor: "text",
          }}
          className="rounded ring-1 ring-[var(--color-accent)] ring-offset-1"
          dangerouslySetInnerHTML={{ __html: editContent }}
        />
      </>
    )
  }

  const displayHtml = isEmpty
    ? ""
    : renderContentWithChips(sanitizeHtml(block.content), variables)

  return (
    <div
      data-testid="text-block"
      onDoubleClick={handleDoubleClick}
      style={{
        ...baseStyle,
        cursor: onUpdateBlock ? "pointer" : "default",
      }}
    >
      {isEmpty ? (
        <span className="text-[var(--color-text-subtle)] italic">
          Double-click to add text...
        </span>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
      )}
    </div>
  )
}
