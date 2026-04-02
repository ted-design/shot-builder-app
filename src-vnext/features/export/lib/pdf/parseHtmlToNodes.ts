/**
 * Parses basic HTML into segments that @react-pdf/renderer can render.
 * Handles bold, italic, underline, headings, lists, and plain text.
 */

export interface PdfTextNode {
  readonly text: string
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly fontSize?: number
  readonly heading?: 1 | 2 | 3
}

export interface PdfListNode {
  readonly type: "ul" | "ol"
  readonly items: readonly string[]
}

export type PdfNode = PdfTextNode | PdfListNode

/** Type guard to distinguish list nodes from text nodes */
export function isPdfListNode(node: PdfNode): node is PdfListNode {
  return "type" in node && (node.type === "ul" || node.type === "ol")
}

const HEADING_FONT_SIZES: Record<string, { fontSize: number; heading: 1 | 2 | 3 }> = {
  H1: { fontSize: 18, heading: 1 },
  H2: { fontSize: 14, heading: 2 },
  H3: { fontSize: 12, heading: 3 },
}

interface InlineStyle {
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
}

const DEFAULT_STYLE: InlineStyle = { bold: false, italic: false, underline: false }

/**
 * Parse an HTML string into an array of PdfNodes for PDF rendering.
 * Uses DOMParser for reliable HTML parsing.
 */
export function parseHtmlToNodes(html: string): readonly PdfNode[] {
  if (!html || !html.trim()) return []

  // If the content looks like plain text (no HTML tags), return a single text node
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return [{ text: html }]
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const nodes: PdfNode[] = []

  for (const child of doc.body.childNodes) {
    const parsed = processNode(child, DEFAULT_STYLE)
    nodes.push(...parsed)
  }

  return nodes
}

function processNode(node: Node, parentStyle: InlineStyle): readonly PdfNode[] {
  // Text node — emit as PdfTextNode with inherited styles
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ""
    if (!text) return []
    return [
      {
        text,
        ...(parentStyle.bold ? { bold: true } : {}),
        ...(parentStyle.italic ? { italic: true } : {}),
        ...(parentStyle.underline ? { underline: true } : {}),
      },
    ]
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return []

  const element = node as Element
  const tagName = element.tagName.toUpperCase()

  // Handle list elements
  if (tagName === "UL" || tagName === "OL") {
    return [processListNode(element, tagName.toLowerCase() as "ul" | "ol")]
  }

  // Handle headings
  const headingConfig = HEADING_FONT_SIZES[tagName]
  if (headingConfig) {
    const text = extractTextContent(element)
    if (!text) return []
    return [
      {
        text,
        bold: true,
        fontSize: headingConfig.fontSize,
        heading: headingConfig.heading,
      },
    ]
  }

  // Handle BR
  if (tagName === "BR") {
    return [{ text: "\n" }]
  }

  // Compute style for inline elements
  const style = computeStyle(tagName, parentStyle)

  // For block-level elements (P, DIV), process children and append newline
  if (tagName === "P" || tagName === "DIV") {
    const childNodes = processChildren(element, style)
    if (childNodes.length === 0) return [{ text: "\n" }]
    return [...childNodes, { text: "\n" }]
  }

  // For inline elements (B, STRONG, I, EM, U, SPAN, etc.), process children
  return processChildren(element, style)
}

function computeStyle(tagName: string, parentStyle: InlineStyle): InlineStyle {
  switch (tagName) {
    case "B":
    case "STRONG":
      return { ...parentStyle, bold: true }
    case "I":
    case "EM":
      return { ...parentStyle, italic: true }
    case "U":
      return { ...parentStyle, underline: true }
    default:
      return parentStyle
  }
}

function processChildren(element: Element, style: InlineStyle): readonly PdfNode[] {
  const results: PdfNode[] = []
  for (const child of element.childNodes) {
    results.push(...processNode(child, style))
  }
  return results
}

function processListNode(element: Element, listType: "ul" | "ol"): PdfListNode {
  const items: string[] = []
  for (const child of element.children) {
    if (child.tagName.toUpperCase() === "LI") {
      items.push(extractTextContent(child))
    }
  }
  return { type: listType, items }
}

/** Recursively extract all text content from an element */
function extractTextContent(element: Element): string {
  return element.textContent?.trim() ?? ""
}
