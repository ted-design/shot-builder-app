import { useCallback } from "react"
import {
  Bold,
  Italic,
  Underline,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
} from "lucide-react"
import { Button } from "@/ui/button"

interface FloatingTextToolbarProps {
  readonly position: { top: number; left: number } | null
  readonly onFormat: (command: string, value?: string) => void
}

interface ToolbarButton {
  readonly icon: typeof Bold
  readonly label: string
  readonly command: string
  readonly value?: string
}

const FORMAT_BUTTONS: readonly ToolbarButton[] = [
  { icon: Bold, label: "Bold", command: "bold" },
  { icon: Italic, label: "Italic", command: "italic" },
  { icon: Underline, label: "Underline", command: "underline" },
]

const HEADING_BUTTONS: readonly ToolbarButton[] = [
  { icon: Pilcrow, label: "Paragraph", command: "formatBlock", value: "p" },
  { icon: Heading1, label: "Heading 1", command: "formatBlock", value: "h1" },
  { icon: Heading2, label: "Heading 2", command: "formatBlock", value: "h2" },
  { icon: Heading3, label: "Heading 3", command: "formatBlock", value: "h3" },
]

const ALIGN_BUTTONS: readonly ToolbarButton[] = [
  { icon: AlignLeft, label: "Align Left", command: "justifyLeft" },
  { icon: AlignCenter, label: "Align Center", command: "justifyCenter" },
  { icon: AlignRight, label: "Align Right", command: "justifyRight" },
]

const LIST_BUTTONS: readonly ToolbarButton[] = [
  { icon: List, label: "Bullet List", command: "insertUnorderedList" },
  { icon: ListOrdered, label: "Numbered List", command: "insertOrderedList" },
]

function ToolbarGroup({
  buttons,
  onFormat,
}: {
  readonly buttons: readonly ToolbarButton[]
  readonly onFormat: (command: string, value?: string) => void
}) {
  return (
    <>
      {buttons.map(({ icon: Icon, label, command, value }) => (
        <Button
          key={command + (value ?? "")}
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[var(--color-text)]"
          title={label}
          aria-label={label}
          onMouseDown={(e) => {
            e.preventDefault()
            onFormat(command, value)
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </>
  )
}

export function FloatingTextToolbar({ position, onFormat }: FloatingTextToolbarProps) {
  const handleFormat = useCallback(
    (command: string, value?: string) => {
      onFormat(command, value)
    },
    [onFormat],
  )

  if (!position) return null

  return (
    <div
      data-testid="floating-text-toolbar"
      className="fixed z-50 flex items-center gap-px rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 shadow-lg"
      style={{
        top: `${String(position.top)}px`,
        left: `${String(position.left)}px`,
        transform: "translateX(-50%)",
      }}
    >
      <ToolbarGroup buttons={FORMAT_BUTTONS} onFormat={handleFormat} />
      <div className="mx-0.5 h-5 w-px bg-[var(--color-border)]" />
      <ToolbarGroup buttons={HEADING_BUTTONS} onFormat={handleFormat} />
      <div className="mx-0.5 h-5 w-px bg-[var(--color-border)]" />
      <ToolbarGroup buttons={ALIGN_BUTTONS} onFormat={handleFormat} />
      <div className="mx-0.5 h-5 w-px bg-[var(--color-border)]" />
      <ToolbarGroup buttons={LIST_BUTTONS} onFormat={handleFormat} />
    </div>
  )
}
