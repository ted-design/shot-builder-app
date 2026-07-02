import { View, Text } from "@react-pdf/renderer"
import type { ReportProduct } from "../reportTypes"
import { sizeLabel } from "../reportModel"
import { COLOR, FONT, has } from "../reportPdfShared"
import { qtyGlyph } from "./qtyGlyph"
import { deriveHeroMarkSpec, renderHeroMarkPdf } from "./heroMark"

// Canonical ProductRow primitive (Phase 2). ONE spec interface + two pure
// derivers + the @react-pdf adapter. The DOM adapter (../../components/report/
// primitives/ProductRow.tsx) presents the SAME spec, so screen and PDF can't
// drift. Pure-additive: no existing renderer imports this yet (Phase 3/4).
//
// The row REUSES the HeroMark primitive for the hero cell + tag (ink dot + bold
// + uppercase INK "HERO" — no red). The pending-qty glyph is "—" (kills "×—").

/** compact = image-led (style demoted to a meta sub-line, 5 columns);
 *  full = production-sheet / balanced-rows (6 columns incl. Style). */
export type ProductColumnSet = "compact" | "full"

export interface ProductRowSpec {
  readonly kind: "productRow"
  readonly family: string // ReportProduct.family or 'Unnamed product'
  readonly style: string | null
  readonly colour: string | null
  readonly sizeText: string // sizeLabel(...).text
  readonly sizePending: boolean // sizeLabel(...).pending -> muted
  readonly qtyText: string // qtyGlyph(qty)
  readonly isHero: boolean
  readonly columns: ProductColumnSet
  readonly colourPlaceholder: string // caller per-recipe ('Colour TBD' | 'Unspecified' | '—')
  readonly stylePlaceholder: string // caller per-recipe ('—' | 'no style #')
  readonly familyPlaceholder: string // 'Unnamed product' (default)
}

export interface ProductRowInput {
  readonly product: ReportProduct
  readonly columns: ProductColumnSet
  readonly colourPlaceholder: string
  readonly stylePlaceholder: string
}

/** Header row variant — column titles matching the ProductRow grid. */
export interface ProductColHeadSpec {
  readonly kind: "productColHead"
  readonly columns: ProductColumnSet
  readonly headers: readonly string[]
}

/** Discriminated union so the adapters switch exhaustively (tsc tripwire). */
export type ProductRowResolvedSpec = ProductRowSpec | ProductColHeadSpec

// Canonical placeholders / column headers — single-sourced consts so a value
// change is an owned diff both adapters resolve from.
const FAMILY_PLACEHOLDER = "Unnamed product"

const COL_HEADERS: Record<ProductColumnSet, readonly string[]> = {
  full: ["", "Family", "Style", "Colour", "Size", "Qty"],
  compact: ["", "Family", "Colour", "Size", "Qty"],
}

/** Resolve a report product + column set to its renderer-agnostic row spec.
 *  Pure: no mutation, returns a new object. style/colour pass through raw so the
 *  adapter applies the caller-supplied placeholders (nothing hardcoded). */
export function deriveProductRowSpec(input: ProductRowInput): ProductRowSpec {
  const { product, columns, colourPlaceholder, stylePlaceholder } = input
  const size = sizeLabel(product.sizeScope, product.size)
  return {
    kind: "productRow",
    family: has(product.family) ? product.family : FAMILY_PLACEHOLDER,
    style: product.style,
    colour: product.colour,
    sizeText: size.text,
    sizePending: size.pending,
    qtyText: qtyGlyph(product.qty),
    isHero: product.isHero,
    columns,
    colourPlaceholder,
    stylePlaceholder,
    familyPlaceholder: FAMILY_PLACEHOLDER,
  }
}

/** Resolve the header row spec for a column set. Pure. */
export function deriveProductColHeadSpec(columns: ProductColumnSet): ProductColHeadSpec {
  return {
    kind: "productColHead",
    columns,
    headers: COL_HEADERS[columns],
  }
}

// ---------------------------------------------------------------------------
// @react-pdf adapter — the only side importing @react-pdf (stays in the lazy
// pdf chunk). Exhaustive via the explicit return type + the `never` default so
// a future missing variant is a tsc error (red build).
// ---------------------------------------------------------------------------

/** Render a resolved ProductRow spec to @react-pdf primitives. */
export function renderProductRowPdf(spec: ProductRowResolvedSpec): React.ReactElement {
  switch (spec.kind) {
    case "productRow":
      return renderProductRowBodyPdf(spec)
    case "productColHead":
      return renderProductColHeadPdf(spec)
    default:
      return assertNever(spec)
  }
}

function renderProductRowBodyPdf(spec: ProductRowSpec): React.ReactElement {
  const full = spec.columns === "full"
  return (
    <View
      data-testid="product-row"
      style={{
        flexDirection: "row",
        paddingVertical: 3.5,
        borderBottomWidth: 0.5,
        borderBottomColor: COLOR.rule,
      }}
    >
      <View style={{ width: 8, flexDirection: "row" }}>
        {renderHeroMarkPdf(deriveHeroMarkSpec({ isHero: spec.isHero }))}
      </View>
      <View style={{ flex: full ? 1.7 : 1.55, flexDirection: "row", flexWrap: "wrap" }}>
        <Text
          data-testid="pr-family"
          style={{
            fontFamily: spec.isHero ? FONT.uiBold : FONT.ui,
            fontSize: 7.5,
            color: COLOR.text,
          }}
        >
          {spec.family}
        </Text>
        {spec.isHero ? renderHeroMarkPdf(deriveHeroMarkSpec({ isHero: true })) : null}
        {!full ? (
          <Text
            data-testid="pr-style-meta"
            style={{ width: "100%", fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSecondary }}
          >
            {has(spec.style) ? spec.style : spec.stylePlaceholder}
          </Text>
        ) : null}
      </View>
      {full ? (
        <Text
          data-testid="pr-style"
          style={{ flex: 0.9, fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSecondary }}
        >
          {has(spec.style) ? spec.style : spec.stylePlaceholder}
        </Text>
      ) : null}
      <Text
        data-testid="pr-colour"
        style={{ flex: full ? 0.9 : 1, fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSecondary }}
      >
        {has(spec.colour) ? spec.colour : spec.colourPlaceholder}
      </Text>
      <Text
        data-testid="pr-size"
        style={{
          width: full ? 44 : 42,
          fontSize: 6.5,
          color: spec.sizePending ? COLOR.textSubtle : COLOR.text,
          fontFamily: spec.sizePending ? FONT.bodyItalic : FONT.ui,
          textAlign: "right",
        }}
      >
        {spec.sizeText}
      </Text>
      <Text
        data-testid="pr-qty"
        style={{ width: 26, fontSize: 6.5, color: COLOR.textSubtle, textAlign: "right" }}
      >
        {spec.qtyText}
      </Text>
    </View>
  )
}

function renderProductColHeadPdf(spec: ProductColHeadSpec): React.ReactElement {
  const full = spec.columns === "full"
  // Per-cell widths match the body row so the header aligns to the grid.
  const widths: readonly (number | { flex: number })[] = full
    ? [{ flex: 0 }, { flex: 1.7 }, { flex: 0.9 }, { flex: 0.9 }, 44, 26]
    : [{ flex: 0 }, { flex: 1.55 }, { flex: 1 }, 42, 26]
  const heroWidth = 8
  return (
    <View
      data-testid="product-colhead"
      style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.rule }}
    >
      {spec.headers.map((label, i) => {
        const w = widths[i]
        const isHeroCol = i === 0
        const isNumeric = i >= spec.headers.length - 2
        const base = {
          fontFamily: FONT.uiBold,
          fontSize: 5,
          color: COLOR.textSubtle,
          textTransform: "uppercase" as const,
          textAlign: (isNumeric ? "right" : "left") as "right" | "left",
        }
        const style = isHeroCol
          ? { ...base, width: heroWidth }
          : typeof w === "number"
            ? { ...base, width: w }
            : { ...base, flex: w?.flex ?? 1 }
        return (
          <Text key={String(i)} data-testid="pr-head-cell" style={style}>
            {label}
          </Text>
        )
      })}
    </View>
  )
}

/** Exhaustiveness tripwire — a future missing variant fails typecheck here. */
function assertNever(x: never): never {
  throw new Error(`Unhandled ProductRow spec variant: ${JSON.stringify(x)}`)
}
