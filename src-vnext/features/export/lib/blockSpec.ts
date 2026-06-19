import type {
  DividerBlock,
  ExportVariable,
  TextBlock,
} from "../types/exportBuilder"
import { resolveVariables } from "./exportVariables"
import { parseHtmlToNodes, type PdfNode } from "./pdf/parseHtmlToNodes"

// Pure, px-canonical, presentation-free block specs. The DOM + @react-pdf
// adapters both present the SAME spec, so the two renderers can't drift.
// (parseHtmlToNodes / exportVariables are @react-pdf-free, so this module
// stays in the eager preview chunk.)

export type DividerLineStyle = NonNullable<DividerBlock["style"]>

export interface DividerSpec {
  readonly kind: "divider"
  readonly lineStyle: DividerLineStyle
  readonly color: string
  readonly thicknessPx: number
  readonly marginYPx: number
}

/** Resolved typography intents for a text block (px-canonical). */
export interface TextTypographySpec {
  readonly fontSizePx: number
  readonly fontWeight: number | undefined
  readonly textAlign: "left" | "center" | "right"
  readonly color: string
  readonly fontFamily: string
  readonly lineHeight: number
  readonly highlightColor: string | undefined
  readonly isHeading: boolean
}

/** One run of plain text; unresolved {{tokens}} are flagged for warning paint. */
export interface TextRun {
  readonly text: string
  readonly unresolved: boolean
}

/**
 * A resolved content segment. Non-render variables are already resolved to
 * values; render tokens stay as markers (the PDF resolves them via @react-pdf's
 * render callback, the preview shows a sentinel since it has no page context).
 */
export type TextSegment =
  | { readonly kind: "renderToken"; readonly token: "pageNumber" | "pageCount" }
  | { readonly kind: "richText"; readonly nodes: readonly PdfNode[] }
  | { readonly kind: "plainText"; readonly runs: readonly TextRun[] }

export interface TextSpec {
  readonly kind: "text"
  readonly isEmpty: boolean
  readonly typography: TextTypographySpec
  readonly segments: readonly TextSegment[]
}

/** Discriminated union of resolved block specs — grows one variant per block type. */
export type ResolvedBlockSpec = DividerSpec | TextSpec

// Canonical divider defaults — the single source both renderers resolve from.
// (Replaces the View `#d1d5db`/1px vs PDF `#D1D5DB`/0.5pt fork.)
const DIVIDER_DEFAULT_COLOR = "#D1D5DB"
const DIVIDER_THICKNESS_PX = 1
const DIVIDER_MARGIN_Y_PX = 8

/** Resolve a DividerBlock to its renderer-agnostic spec. */
export function deriveDividerSpec(block: DividerBlock): DividerSpec {
  return {
    kind: "divider",
    lineStyle: block.style ?? "solid",
    color: block.color ?? DIVIDER_DEFAULT_COLOR,
    thicknessPx: DIVIDER_THICKNESS_PX,
    marginYPx: DIVIDER_MARGIN_Y_PX,
  }
}

// Canonical text defaults — one source both renderers resolve from.
export const HEADING_FONT_SIZE_PX = { h1: 24, h2: 20, h3: 16 } as const
const TEXT_BASE_FONT_SIZE_PX = 14
const TEXT_DEFAULT_COLOR = "#111827" // page house gray-900
const TEXT_DEFAULT_FONT_FAMILY = "Inter"
const TEXT_LINE_HEIGHT = 1.5

const RENDER_TOKENS = new Set(["pageNumber", "pageCount"])
const RENDER_TOKEN_SPLIT = /(\{\{pageNumber\}\}|\{\{pageCount\}\})/g
const TOKEN_SPLIT = /(\{\{\w+\}\})/g
const TOKEN_EXACT = /^\{\{(\w+)\}\}$/

/** Environment a text spec resolves against (the variables in scope). */
export interface TextSpecEnv {
  readonly variables: readonly ExportVariable[]
}

function containsHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content)
}

/** Split plain text into runs, flagging {{tokens}} unknown to the env as unresolved. */
function splitPlainTextRuns(
  text: string,
  knownKeys: ReadonlySet<string>,
): readonly TextRun[] {
  return text
    .split(TOKEN_SPLIT)
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = TOKEN_EXACT.exec(part)
      const key = match?.[1]
      const unresolved =
        key !== undefined && !knownKeys.has(key) && !RENDER_TOKENS.has(key)
      return { text: part, unresolved }
    })
}

/** Resolve a TextBlock's content to an ordered, renderer-agnostic segment stream. */
function deriveTextSegments(
  content: string,
  variables: readonly ExportVariable[],
): readonly TextSegment[] {
  const knownKeys = new Set(variables.map((v) => v.key))
  const resolved = resolveVariables(content, variables)

  return resolved
    .split(RENDER_TOKEN_SPLIT)
    .filter((part) => part.length > 0)
    .map((part): TextSegment => {
      if (part === "{{pageNumber}}")
        return { kind: "renderToken", token: "pageNumber" }
      if (part === "{{pageCount}}")
        return { kind: "renderToken", token: "pageCount" }
      if (containsHtml(part))
        return { kind: "richText", nodes: parseHtmlToNodes(part) }
      return { kind: "plainText", runs: splitPlainTextRuns(part, knownKeys) }
    })
}

/** Resolve a TextBlock + env to its renderer-agnostic spec. */
export function deriveTextSpec(block: TextBlock, env: TextSpecEnv): TextSpec {
  const t = block.typography
  const blockType = t?.blockType ?? "p"
  const isHeading = blockType !== "p"
  const fontSizePx = isHeading
    ? HEADING_FONT_SIZE_PX[blockType]
    : (t?.fontSize ?? TEXT_BASE_FONT_SIZE_PX)

  return {
    kind: "text",
    isEmpty: !block.content,
    typography: {
      fontSizePx,
      fontWeight: isHeading ? 700 : undefined,
      textAlign: t?.textAlign ?? "left",
      color: t?.fontColor ?? TEXT_DEFAULT_COLOR,
      fontFamily: t?.fontFamily ?? TEXT_DEFAULT_FONT_FAMILY,
      lineHeight: TEXT_LINE_HEIGHT,
      highlightColor: t?.highlightColor,
      isHeading,
    },
    segments: block.content ? deriveTextSegments(block.content, env.variables) : [],
  }
}
