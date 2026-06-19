import {
  HEADING_FONT_SIZE_PX,
  type ResolvedBlockSpec,
  type TextSegment,
  type TextSpec,
} from "../blockSpec"
import {
  isPdfListNode,
  type PdfNode,
  type PdfTextNode,
} from "../pdf/parseHtmlToNodes"

// DOM presenter for ResolvedBlockSpec. Spacing/typography are rendered inline
// from the spec (not Tailwind classes) so the DOM and PDF consume one source
// and can't drift. The text display path mirrors the PDF: variables resolved to
// values, render tokens shown as a sentinel, unresolved tokens warning-painted.

// Same warning palette the PDF adapter paints, so the two stay in parity.
const WARNING_BG = "#FEF3C7"
const WARNING_FG = "#92400E"

/** Render a resolved block spec to DOM primitives. */
export function renderBlockSpecDom(spec: ResolvedBlockSpec): React.ReactElement {
  switch (spec.kind) {
    case "divider":
      return (
        <hr
          data-testid="divider-block"
          style={{
            borderTopStyle: spec.lineStyle,
            borderTopWidth: `${String(spec.thicknessPx)}px`,
            borderTopColor: spec.color,
            borderBottom: "none",
            borderLeft: "none",
            borderRight: "none",
            marginTop: `${String(spec.marginYPx)}px`,
            marginBottom: `${String(spec.marginYPx)}px`,
          }}
        />
      )
    case "text":
      return renderTextSpecDom(spec)
    default: {
      const _exhaustive: never = spec
      return _exhaustive
    }
  }
}

function renderTextSpecDom(spec: TextSpec): React.ReactElement {
  const t = spec.typography
  const style: React.CSSProperties = {
    fontSize: `${String(t.fontSizePx)}px`,
    fontWeight: t.fontWeight,
    textAlign: t.textAlign,
    color: t.color,
    fontFamily: t.fontFamily,
    lineHeight: t.lineHeight,
    minHeight: "1.5em",
    backgroundColor: t.highlightColor,
  }
  return (
    <div data-testid="text-block-content" style={style}>
      {spec.segments.map((seg, i) => renderSegmentDom(seg, i))}
    </div>
  )
}

function renderSegmentDom(seg: TextSegment, key: number): React.ReactNode {
  if (seg.kind === "renderToken") {
    // Preview has no page context — show a sentinel placeholder.
    return (
      <span key={key} data-render-token={seg.token} style={{ color: "#9CA3AF" }}>
        #
      </span>
    )
  }
  if (seg.kind === "plainText") {
    return seg.runs.map((run, ri) =>
      run.unresolved ? (
        <span
          key={`${String(key)}-${String(ri)}`}
          data-unresolved-token="true"
          style={{ backgroundColor: WARNING_BG, color: WARNING_FG }}
        >
          {run.text}
        </span>
      ) : (
        <span key={`${String(key)}-${String(ri)}`}>{run.text}</span>
      ),
    )
  }
  return renderNodesDom(seg.nodes, key)
}

function renderNodesDom(
  nodes: readonly PdfNode[],
  keyPrefix: number,
): React.ReactNode {
  return nodes.map((node, ni) => {
    const key = `${String(keyPrefix)}-${String(ni)}`
    if (isPdfListNode(node)) {
      const Tag = node.type === "ul" ? "ul" : "ol"
      return (
        <Tag key={key} style={{ paddingLeft: "1.25em", margin: 0 }}>
          {node.items.map((item, ii) => (
            <li key={ii}>{item}</li>
          ))}
        </Tag>
      )
    }
    return renderTextNodeDom(node, key)
  })
}

function renderTextNodeDom(node: PdfTextNode, key: string): React.ReactNode {
  if (node.text === "\n") return <br key={key} />

  const style: React.CSSProperties = {}
  if (node.heading) style.fontSize = `${String(HEADING_FONT_SIZE_PX[`h${node.heading}`])}px`
  if (node.bold || node.heading) style.fontWeight = 700
  if (node.italic) style.fontStyle = "italic"
  if (node.underline) style.textDecoration = "underline"

  return (
    <span key={key} style={style}>
      {node.text}
    </span>
  )
}
