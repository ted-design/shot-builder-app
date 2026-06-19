import { Text, View } from "@react-pdf/renderer"
import type { Style } from "@react-pdf/types"
import {
  HEADING_FONT_SIZE_PX,
  type ResolvedBlockSpec,
  type TextRun,
  type TextSegment,
  type TextSpec,
} from "../../blockSpec"
import { pxToPt } from "../../units"
import { mapFontFamilyToPdf } from "../fontMapping"
import {
  isPdfListNode,
  type PdfNode,
  type PdfTextNode,
} from "../parseHtmlToNodes"

// @react-pdf presenter for ResolvedBlockSpec — the only adapter importing
// @react-pdf, so it stays in the lazy pdf chunk. The text path consumes the
// same resolved spec the DOM does; @react-pdf's no-View-inside-Text rule is a
// rendering constraint handled here only (the spec stays presentation-free).

const WARNING_BG = "#FEF3C7"
const WARNING_FG = "#92400E"

/** Render a resolved block spec to @react-pdf primitives. */
export function renderBlockSpecPdf(spec: ResolvedBlockSpec): React.ReactElement {
  switch (spec.kind) {
    case "divider":
      return (
        <View
          style={{
            borderBottomWidth: pxToPt(spec.thicknessPx),
            borderBottomColor: spec.color,
            borderBottomStyle: spec.lineStyle,
            marginVertical: pxToPt(spec.marginYPx),
          }}
        />
      )
    case "text":
      return renderTextSpecPdf(spec)
    default: {
      const _exhaustive: never = spec
      return _exhaustive
    }
  }
}

function renderTextSpecPdf(spec: TextSpec): React.ReactElement {
  const t = spec.typography
  const baseFontSizePt = pxToPt(t.fontSizePx)
  const textStyle: Style = {
    fontSize: baseFontSizePt,
    color: t.color,
    lineHeight: t.lineHeight,
    textAlign: t.textAlign,
    fontFamily: mapFontFamilyToPdf(t.fontFamily, t.isHeading),
  }
  const containerStyle: Style = t.highlightColor
    ? { backgroundColor: t.highlightColor }
    : {}

  // @react-pdf can't nest <View> (lists) inside <Text>. If any segment carries a
  // list, render every segment at View level; otherwise wrap inline in one Text.
  const hasBlockHtml = spec.segments.some(
    (s) => s.kind === "richText" && s.nodes.some(isPdfListNode),
  )

  if (hasBlockHtml) {
    return (
      <View style={containerStyle}>
        {spec.segments.map((seg, i) =>
          renderSegmentBlockPdf(seg, i, textStyle, t.fontFamily, baseFontSizePt),
        )}
      </View>
    )
  }

  return (
    <View style={containerStyle}>
      <Text style={textStyle}>
        {spec.segments.map((seg, i) =>
          renderSegmentInlinePdf(seg, i, t.fontFamily, baseFontSizePt),
        )}
      </Text>
    </View>
  )
}

/** Render a segment as a top-level (View-level) element. */
function renderSegmentBlockPdf(
  seg: TextSegment,
  key: number,
  textStyle: Style,
  baseFontFamily: string | undefined,
  baseFontSizePt: number,
): React.ReactNode {
  if (seg.kind === "renderToken") {
    return renderRenderTokenPdf(seg.token, key, textStyle)
  }
  if (seg.kind === "plainText") {
    return (
      <Text key={key} style={textStyle}>
        {renderRunsPdf(seg.runs)}
      </Text>
    )
  }
  const groups = groupNodes(seg.nodes)
  return (
    <View key={key}>
      {groups.map((group, gi) =>
        group.type === "list" ? (
          renderPdfNode(group.node, gi, baseFontSizePt, baseFontFamily)
        ) : (
          <Text key={gi} style={textStyle}>
            {group.nodes.map((node, ni) =>
              renderPdfNode(node, ni, baseFontSizePt, baseFontFamily),
            )}
          </Text>
        ),
      )}
    </View>
  )
}

/** Render a segment as inline children of a single wrapping <Text>. */
function renderSegmentInlinePdf(
  seg: TextSegment,
  key: number,
  baseFontFamily: string | undefined,
  baseFontSizePt: number,
): React.ReactNode {
  if (seg.kind === "renderToken") {
    return renderRenderTokenPdf(seg.token, key)
  }
  if (seg.kind === "plainText") {
    return <Text key={key}>{renderRunsPdf(seg.runs)}</Text>
  }
  return seg.nodes.map((node, ni) =>
    renderPdfNode(node, key * 1000 + ni, baseFontSizePt, baseFontFamily),
  )
}

function renderRenderTokenPdf(
  token: "pageNumber" | "pageCount",
  key: number,
  style?: Style,
): React.ReactNode {
  if (token === "pageNumber") {
    return <Text key={key} style={style} render={({ pageNumber }) => String(pageNumber)} />
  }
  return <Text key={key} style={style} render={({ totalPages }) => String(totalPages)} />
}

/** Render plain-text runs, warning-painting the unresolved {{tokens}}. */
function renderRunsPdf(runs: readonly TextRun[]): React.ReactNode {
  return runs.map((run, i) =>
    run.unresolved ? (
      <Text key={i} style={{ backgroundColor: WARNING_BG, color: WARNING_FG }}>
        {run.text}
      </Text>
    ) : (
      run.text
    ),
  )
}

function buildTextNodeStyle(
  node: PdfTextNode,
  baseFontFamily: string | undefined,
): Style {
  const result: Style = {
    fontFamily: mapFontFamilyToPdf(baseFontFamily, node.bold, node.italic),
  }
  if (node.underline) result.textDecoration = "underline"
  if (node.heading) result.fontSize = pxToPt(HEADING_FONT_SIZE_PX[`h${node.heading}`])
  return result
}

function renderPdfNode(
  node: PdfNode,
  index: number,
  baseFontSizePt: number,
  baseFontFamily: string | undefined,
): React.ReactNode {
  if (isPdfListNode(node)) {
    return (
      <View key={index} style={{ marginTop: 2, marginBottom: 2 }}>
        {node.items.map((item, i) => {
          const prefix = node.type === "ul" ? "•" : `${String(i + 1)}.`
          return (
            <Text
              key={i}
              style={{
                fontSize: baseFontSizePt,
                fontFamily: mapFontFamilyToPdf(baseFontFamily),
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
  return (
    <Text key={index} style={buildTextNodeStyle(node, baseFontFamily)}>
      {node.text}
    </Text>
  )
}

type NodeGroup =
  | { readonly type: "text"; readonly nodes: readonly PdfNode[] }
  | { readonly type: "list"; readonly node: PdfNode }

/** Group consecutive text nodes together, keeping list nodes separate. */
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
