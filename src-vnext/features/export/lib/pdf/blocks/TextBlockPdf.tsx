import { Text, View } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import type { TextBlock, ExportVariable } from "../../../types/exportBuilder"
import { resolveVariables } from "../../exportVariables"
import { styles } from "../pdfStyles"
import {
  parseHtmlToNodes,
  isPdfListNode,
  type PdfNode,
  type PdfTextNode,
} from "../parseHtmlToNodes"

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
): readonly {
  readonly type: "text" | "pageNumber" | "pageCount"
  readonly value: string
}[] {
  const pattern = /(\{\{pageNumber\}\}|\{\{pageCount\}\})/g
  const parts = content.split(pattern)

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      if (part === "{{pageNumber}}")
        return { type: "pageNumber" as const, value: "" }
      if (part === "{{pageCount}}")
        return { type: "pageCount" as const, value: "" }
      return { type: "text" as const, value: part }
    })
}

/** Map fontFamily name to the Helvetica-based PDF font */
function resolvePdfFontFamily(
  fontFamily: string | undefined,
  bold?: boolean,
  italic?: boolean,
): string {
  const base = fontFamily ?? "Helvetica"

  if (base === "Courier New" || base === "Courier") {
    if (bold && italic) return "Courier-BoldOblique"
    if (bold) return "Courier-Bold"
    if (italic) return "Courier-Oblique"
    return "Courier"
  }
  if (base === "Georgia" || base === "Times New Roman") {
    if (bold && italic) return "Times-BoldItalic"
    if (bold) return "Times-Bold"
    if (italic) return "Times-Italic"
    return "Times-Roman"
  }

  if (bold && italic) return "Helvetica-BoldOblique"
  if (bold) return "Helvetica-Bold"
  if (italic) return "Helvetica-Oblique"
  return "Helvetica"
}

/** Build style object for a PdfTextNode */
function buildTextNodeStyle(
  node: PdfTextNode,
  baseFontFamily: string | undefined,
): Style {
  const result: Style = {
    fontFamily: resolvePdfFontFamily(baseFontFamily, node.bold, node.italic),
  }

  if (node.underline) {
    result.textDecoration = "underline"
  }

  if (node.heading) {
    const headingSizes = { 1: 18, 2: 14, 3: 12 } as const
    result.fontSize = node.fontSize ?? headingSizes[node.heading]
  }

  return result
}

/** Render a single PdfNode */
function renderPdfNode(
  node: PdfNode,
  index: number,
  baseFontSize: number,
  baseFontFamily: string | undefined,
): React.ReactNode {
  if (isPdfListNode(node)) {
    return (
      <View key={index} style={{ marginTop: 2, marginBottom: 2 }}>
        {node.items.map((item, i) => {
          const prefix =
            node.type === "ul" ? "\u2022" : `${String(i + 1)}.`
          return (
            <Text
              key={i}
              style={{
                fontSize: baseFontSize,
                fontFamily: resolvePdfFontFamily(baseFontFamily),
                marginBottom: 1,
                paddingLeft: 12,
              }}
            >
              {`${prefix} ${item}`}
            </Text>
          )
        })}
      </View>
    )
  }

  const textNode = node as PdfTextNode
  const nodeStyle = buildTextNodeStyle(textNode, baseFontFamily)

  return (
    <Text key={index} style={nodeStyle}>
      {textNode.text}
    </Text>
  )
}

/** Checks if content contains HTML tags */
function containsHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content)
}

export function TextBlockPdf({ block, variables }: TextBlockPdfProps) {
  if (!block.content) return null

  const layout = block.layout
  const blockType = block.typography?.blockType ?? "p"
  const headingSizes = { h1: 18, h2: 14, h3: 12, p: undefined } as const
  const baseFontSize = block.typography?.fontSize ?? 10
  const fontSize = headingSizes[blockType] ?? baseFontSize
  const textAlign = block.typography?.textAlign ?? "left"
  const fontColor = block.typography?.fontColor ?? "#111827"
  const fontFamily = block.typography?.fontFamily
  const highlightColor = block.typography?.highlightColor
  const isHeading = blockType !== "p"

  const containerStyle: Style = {
    marginTop: layout?.marginTop ?? 0,
    marginRight: layout?.marginRight ?? 0,
    marginBottom: layout?.marginBottom ?? 0,
    marginLeft: layout?.marginLeft ?? 0,
    paddingTop: layout?.paddingTop ?? 0,
    paddingRight: layout?.paddingRight ?? 0,
    paddingBottom: layout?.paddingBottom ?? 0,
    paddingLeft: layout?.paddingLeft ?? 0,
    ...(highlightColor ? { backgroundColor: highlightColor } : {}),
  }

  const textStyle: Style = {
    ...styles.bodyText,
    fontSize,
    textAlign: textAlign as "left" | "center" | "right",
    color: fontColor,
    fontFamily: resolvePdfFontFamily(fontFamily, isHeading),
  }

  // First resolve non-render variables
  const resolved = resolveVariables(block.content, variables)

  // Render tokens ({{pageNumber}}, {{pageCount}}) require @react-pdf/renderer's
  // render callback — check for them FIRST so they're never swallowed by the
  // HTML-only path.
  if (hasRenderTokens(resolved)) {
    const segments = splitRenderTokens(resolved)

    // Check if any text segment contains block-level HTML (lists).
    // If so, we must render at the View level to avoid nesting <View> inside <Text>.
    const hasBlockHtml = segments.some(
      (seg) =>
        seg.type === "text" &&
        containsHtml(seg.value) &&
        parseHtmlToNodes(seg.value).some(isPdfListNode),
    )

    if (hasBlockHtml) {
      // Fragment-based: each segment renders as its own top-level element
      return (
        <View style={containerStyle}>
          {segments.map((seg, i) => {
            if (seg.type === "pageNumber") {
              return (
                <Text key={i} style={textStyle} render={({ pageNumber }) => String(pageNumber)} />
              )
            }
            if (seg.type === "pageCount") {
              return (
                <Text key={i} style={textStyle} render={({ totalPages }) => String(totalPages)} />
              )
            }
            // Text segment — render as full HTML content (View-based) if it has blocks
            if (containsHtml(seg.value)) {
              return renderHtmlContent(seg.value, {}, textStyle, fontSize, fontFamily, i)
            }
            return <Text key={i} style={textStyle}>{seg.value}</Text>
          })}
        </View>
      )
    }

    // All segments are inline-safe — wrap in a single <Text>
    return (
      <View style={containerStyle}>
        <Text style={textStyle}>
          {segments.map((seg, i) => {
            if (seg.type === "pageNumber") {
              return (
                <Text
                  key={i}
                  render={({ pageNumber }) => String(pageNumber)}
                />
              )
            }
            if (seg.type === "pageCount") {
              return (
                <Text
                  key={i}
                  render={({ totalPages }) => String(totalPages)}
                />
              )
            }
            // Text segment — may contain inline HTML markup
            if (containsHtml(seg.value)) {
              return renderHtmlSegment(seg.value, fontSize, fontFamily, i)
            }
            return <Text key={i}>{seg.value}</Text>
          })}
        </Text>
      </View>
    )
  }

  // If content contains HTML (but no render tokens), parse into rich nodes
  if (containsHtml(resolved)) {
    return renderHtmlContent(resolved, containerStyle, textStyle, fontSize, fontFamily)
  }

  // Plain text fallback
  return (
    <View style={containerStyle}>
      <Text style={textStyle}>{resolved}</Text>
    </View>
  )
}

/** Render an HTML text segment as inline PDF nodes (used within render-token splits) */
function renderHtmlSegment(
  html: string,
  baseFontSize: number,
  baseFontFamily: string | undefined,
  keyPrefix: number,
): React.ReactNode {
  const pdfNodes = parseHtmlToNodes(html)
  if (pdfNodes.length === 0) return null

  // Within a render-token <Text>, we can only emit inline children.
  // List nodes are unlikely inside a token segment, but handle gracefully
  // by flattening item text. Prefix keys to avoid collisions across segments.
  return pdfNodes.map((node, ni) =>
    renderPdfNode(node, keyPrefix * 1000 + ni, baseFontSize, baseFontFamily),
  )
}

/** Render full HTML content (no render tokens) wrapped in container + grouped text */
function renderHtmlContent(
  html: string,
  containerStyle: Style,
  textStyle: Style,
  baseFontSize: number,
  baseFontFamily: string | undefined,
  key?: number,
): React.ReactNode {
  const pdfNodes = parseHtmlToNodes(html)
  if (pdfNodes.length === 0) return null

  const groups = groupNodes(pdfNodes)

  return (
    <View key={key} style={containerStyle}>
      {groups.map((group, gi) => {
        if (group.type === "list") {
          return renderPdfNode(group.node, gi, baseFontSize, baseFontFamily)
        }
        return (
          <Text key={gi} style={textStyle}>
            {group.nodes.map((node, ni) =>
              renderPdfNode(node, ni, baseFontSize, baseFontFamily),
            )}
          </Text>
        )
      })}
    </View>
  )
}

/** Group consecutive text nodes together, keeping list nodes separate */
type NodeGroup =
  | { readonly type: "text"; readonly nodes: readonly PdfNode[] }
  | { readonly type: "list"; readonly node: PdfNode }

function groupNodes(nodes: readonly PdfNode[]): readonly NodeGroup[] {
  const groups: NodeGroup[] = []
  let currentTextNodes: PdfNode[] = []

  for (const node of nodes) {
    if (isPdfListNode(node)) {
      if (currentTextNodes.length > 0) {
        groups.push({ type: "text", nodes: currentTextNodes })
        currentTextNodes = []
      }
      groups.push({ type: "list", node })
    } else {
      currentTextNodes = [...currentTextNodes, node]
    }
  }

  if (currentTextNodes.length > 0) {
    groups.push({ type: "text", nodes: currentTextNodes })
  }

  return groups
}
