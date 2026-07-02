import type {
  ProductRowInput,
  ProductRowResolvedSpec,
  ProductRowSpec,
  ProductColHeadSpec,
  ProductColumnSet,
} from "../../../lib/report/primitives/productRow"
import {
  deriveProductRowSpec,
  deriveProductColHeadSpec,
} from "../../../lib/report/primitives/productRow"
import { has } from "../../../lib/report/reportPdfShared"
import {
  deriveHeroMarkSpec,
  renderHeroMarkDom,
} from "../../../lib/report/primitives/heroMark"

// DOM adapter for the canonical ProductRow primitive. Presents the SAME spec the
// @react-pdf adapter (../../../lib/report/primitives/productRow.tsx) consumes, so
// screen and PDF can't drift. No @react-pdf import — stays DOM-only / out of the
// lazy pdf chunk. Reuses the HeroMark primitive for the ink dot + HERO tag.

const GRID_COLUMNS: Record<ProductColumnSet, string> = {
  full: "14px minmax(0,1.7fr) minmax(96px,0.9fr) minmax(76px,0.9fr) minmax(64px,auto) 36px",
  compact: "14px minmax(0,1.55fr) minmax(0,1fr) 4.5rem 2.5rem",
}

/** Render a resolved ProductRow spec to DOM primitives. Exhaustive via the
 *  explicit return type + the `never` default (missing variant -> tsc error). */
export function renderProductRowDom(spec: ProductRowResolvedSpec): React.ReactElement {
  switch (spec.kind) {
    case "productRow":
      return renderProductRowBodyDom(spec)
    case "productColHead":
      return renderProductColHeadDom(spec)
    default:
      return assertNever(spec)
  }
}

function renderProductRowBodyDom(spec: ProductRowSpec): React.ReactElement {
  const full = spec.columns === "full"
  return (
    <div
      data-testid="product-row"
      data-hero={String(spec.isHero)}
      data-columns={spec.columns}
      style={{ display: "grid", columnGap: "14px", gridTemplateColumns: GRID_COLUMNS[spec.columns] }}
    >
      <span data-testid="pr-hero" style={{ display: "flex", alignItems: "center" }}>
        {renderHeroMarkDom(deriveHeroMarkSpec({ isHero: spec.isHero }))}
      </span>
      <span
        data-testid="pr-family"
        style={{
          fontFamily: "var(--sb-font-ui)",
          fontSize: "13px",
          color: "var(--sb-ink)",
          fontWeight: spec.isHero ? 600 : 400,
        }}
      >
        {spec.family}
        {spec.isHero ? renderHeroMarkDom(deriveHeroMarkSpec({ isHero: true })) : null}
        {!full ? (
          <span
            data-testid="pr-style-meta"
            style={{ display: "block", fontSize: "12px", color: "var(--sb-ink-3)" }}
          >
            {has(spec.style) ? spec.style : spec.stylePlaceholder}
          </span>
        ) : null}
      </span>
      {full ? (
        <span data-testid="pr-style" style={{ fontSize: "12px", color: "var(--sb-ink-3)" }}>
          {has(spec.style) ? spec.style : spec.stylePlaceholder}
        </span>
      ) : null}
      <span data-testid="pr-colour" style={{ fontSize: "12px", color: "var(--sb-ink-2)" }}>
        {has(spec.colour) ? spec.colour : spec.colourPlaceholder}
      </span>
      <span
        data-testid="pr-size"
        style={{
          fontSize: "12px",
          color: spec.sizePending ? "var(--sb-ink-3)" : "var(--sb-ink-2)",
          fontStyle: spec.sizePending ? "italic" : "normal",
          textAlign: "right",
        }}
      >
        {spec.sizeText}
      </span>
      <span
        data-testid="pr-qty"
        style={{ fontSize: "12px", color: "var(--sb-ink-3)", textAlign: "right" }}
      >
        {spec.qtyText}
      </span>
    </div>
  )
}

function renderProductColHeadDom(spec: ProductColHeadSpec): React.ReactElement {
  return (
    <div
      data-testid="product-colhead"
      style={{
        display: "grid",
        columnGap: "14px",
        gridTemplateColumns: GRID_COLUMNS[spec.columns],
        borderBottom: "1px solid var(--sb-rule)",
      }}
    >
      {spec.headers.map((label, i) => {
        const isNumeric = i >= spec.headers.length - 2
        return (
          <span
            key={String(i)}
            data-testid="pr-head-cell"
            style={{
              fontFamily: "var(--sb-font-ui)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--sb-ink-3)",
              textAlign: isNumeric ? "right" : "left",
            }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

/** Exhaustiveness tripwire — a future missing variant fails typecheck here. */
function assertNever(x: never): never {
  throw new Error(`Unhandled ProductRow spec variant: ${JSON.stringify(x)}`)
}

// --- Thin wrapper components the barrel re-exports (mirror DividerBlockView). ---

/** DOM wrapper: derive + render a product row from raw input. */
export function ProductRowView(props: ProductRowInput): React.ReactElement {
  return renderProductRowDom(deriveProductRowSpec(props))
}

/** DOM wrapper: derive + render the column-header row for a column set. */
export function ProductColHeadView(props: {
  readonly columns: ProductColumnSet
}): React.ReactElement {
  return renderProductRowDom(deriveProductColHeadSpec(props.columns))
}
