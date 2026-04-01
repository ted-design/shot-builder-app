import type { TextBlock, ExportVariable } from "../../types/exportBuilder"

interface TextBlockViewProps {
  readonly block: TextBlock
  readonly variables: readonly ExportVariable[]
}

/** Split text on {{variableKey}} tokens and return alternating text/chip segments */
function renderWithChips(
  content: string,
  variables: readonly ExportVariable[],
): readonly React.ReactNode[] {
  // Match any {{...}} token
  const tokenPattern = /(\{\{[^}]+\}\})/g
  const segments = content.split(tokenPattern)

  const variableMap = new Map(variables.map((v) => [v.key, v]))

  return segments.map((segment, index) => {
    const match = /^\{\{([^}]+)\}\}$/.exec(segment)
    if (!match) {
      return <span key={index}>{segment}</span>
    }

    const key = match[1] ?? ""
    const variable = variableMap.get(key)
    const label = variable?.label ?? key

    return (
      <span
        key={index}
        className="inline-flex items-center rounded bg-indigo-100 px-1.5 text-xs text-indigo-700"
      >
        {label}
      </span>
    )
  })
}

export function TextBlockView({ block, variables }: TextBlockViewProps) {
  const fontSize = block.typography?.fontSize ?? 14
  const textAlign = block.typography?.textAlign ?? "left"
  const fontColor = block.typography?.fontColor ?? "#000000"

  const isEmpty = !block.content

  return (
    <div
      data-testid="text-block"
      style={{
        fontSize: `${String(fontSize)}px`,
        textAlign,
        color: fontColor,
        lineHeight: 1.5,
        minHeight: "1.5em",
      }}
    >
      {isEmpty ? (
        <span className="text-gray-400 italic">Click to add text...</span>
      ) : (
        renderWithChips(block.content, variables)
      )}
    </div>
  )
}
