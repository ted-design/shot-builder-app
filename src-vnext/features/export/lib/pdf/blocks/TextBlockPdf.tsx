import { Text, View } from "@react-pdf/renderer"
import type { TextBlock, ExportVariable } from "../../../types/exportBuilder"
import { resolveVariables } from "../../exportVariables"
import { styles } from "../pdfStyles"

interface TextBlockPdfProps {
  readonly block: TextBlock
  readonly variables: readonly ExportVariable[]
}

/** Checks whether content has page-level render tokens */
function hasRenderTokens(content: string): boolean {
  return content.includes("{{pageNumber}}") || content.includes("{{pageCount}}")
}

/**
 * Splits content on {{pageNumber}} and {{pageCount}} tokens and returns
 * an array of segments: plain strings and render token markers.
 */
function splitRenderTokens(
  content: string,
): readonly { readonly type: "text" | "pageNumber" | "pageCount"; readonly value: string }[] {
  const pattern = /(\{\{pageNumber\}\}|\{\{pageCount\}\})/g
  const parts = content.split(pattern)

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      if (part === "{{pageNumber}}") return { type: "pageNumber" as const, value: "" }
      if (part === "{{pageCount}}") return { type: "pageCount" as const, value: "" }
      return { type: "text" as const, value: part }
    })
}

export function TextBlockPdf({ block, variables }: TextBlockPdfProps) {
  if (!block.content) return null

  const layout = block.layout
  const fontSize = block.typography?.fontSize ?? 10
  const textAlign = block.typography?.textAlign ?? "left"
  const fontColor = block.typography?.fontColor ?? "#111827"

  const containerStyle = {
    marginTop: layout?.marginTop ?? 0,
    marginRight: layout?.marginRight ?? 0,
    marginBottom: layout?.marginBottom ?? 0,
    marginLeft: layout?.marginLeft ?? 0,
    paddingTop: layout?.paddingTop ?? 0,
    paddingRight: layout?.paddingRight ?? 0,
    paddingBottom: layout?.paddingBottom ?? 0,
    paddingLeft: layout?.paddingLeft ?? 0,
  }

  const textStyle = {
    ...styles.bodyText,
    fontSize,
    textAlign: textAlign as "left" | "center" | "right",
    color: fontColor,
  }

  // First resolve non-render variables
  const resolved = resolveVariables(block.content, variables)

  // If no page-level render tokens remain, simple text
  if (!hasRenderTokens(resolved)) {
    return (
      <View style={containerStyle}>
        <Text style={textStyle}>{resolved}</Text>
      </View>
    )
  }

  // Split into segments for render-capable tokens
  const segments = splitRenderTokens(resolved)

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>
        {segments.map((seg, i) => {
          if (seg.type === "pageNumber") {
            return (
              <Text key={i} render={({ pageNumber }) => String(pageNumber)} />
            )
          }
          if (seg.type === "pageCount") {
            return (
              <Text key={i} render={({ totalPages }) => String(totalPages)} />
            )
          }
          return <Text key={i}>{seg.value}</Text>
        })}
      </Text>
    </View>
  )
}
