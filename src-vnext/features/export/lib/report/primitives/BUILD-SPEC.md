# Phase 2 — Canonical Report Primitives — Build Spec


# Phase 2 — Canonical Report Primitives: Grounded Build Spec

Branch `feat/report-canonical-primitives` off `origin/main @6eb4c00a`. Worktree root (ALL paths absolute under it):
`/Users/tedghanime/Documents/App Development/Shot Builder Development/shot-builder-workdir/shotbuilder-phase2`

## 0. Contract (non-negotiable)
- Build **6 canonical primitives** (HeroMark, StatusChip, HoldFlag, UnresolvedBadge, LookLabel, ProductRow+table variant). Each = **ONE spec interface + a pure `derive*Spec()` + TWO adapters (DOM `.tsx` + `@react-pdf` `.tsx`) presenting the SAME spec + a two-layer parity test.**
- **PURE-ADDITIVE.** Land the primitives **unused**. NO existing renderer may import them (adoption is Phase 3/4). Prod output must be **byte-identical** under all flags. **Do NOT edit any existing renderer/style/token file** (`reportStyles.ts`, `reportShared.ts`, `reportPdf.tsx`, `reportPdfProductionSheet.tsx`, `reportPdfBalancedRows.tsx`, `reportPdfShared.ts`, `ReportView.tsx`, `ProductionSheetReport.tsx`, `BalancedRowsReport.tsx`, etc.). The red→ink swap only happens at adoption, later.
- Gate every step with `npm run typecheck:baseline` (baseline-guarded ~160 known errors; a NEW error is a red gate). Run only the new tests: `CI=1 npm test -- --run <path>`. Never run the whole suite.

## 1. File layout (co-located; 6 builders never touch the same file)
For each primitive with camel `<name>` / Pascal `<Name>`:
- **Spec + deriver + PDF adapter (ONE file):** `src-vnext/features/export/lib/report/primitives/<name>.tsx`
- **DOM adapter (thin wrapper):** `src-vnext/features/export/components/report/primitives/<Name>.tsx`
- **Parity test:** `src-vnext/features/export/lib/report/primitives/__tests__/<name>.parity.test.tsx`

Scaffold (one-time, create the dirs + shared files first):
- `src-vnext/features/export/lib/report/primitives/qtyGlyph.ts`
- `src-vnext/features/export/lib/report/primitives/primitiveTokens.ts`
- `src-vnext/features/export/lib/report/primitives/index.ts` (barrel)
- `src-vnext/features/export/lib/report/primitives/__tests__/` (dir)
- `src-vnext/features/export/components/report/primitives/` (dir)

## 2. Import-depth cheat sheet (verified against the tree)
The primitives live one level DEEPER than the Divider template (`lib/report/primitives/` vs `lib/`). Depths:

Spec/deriver/PDF adapter at `lib/report/primitives/<name>.tsx`:
- units (pxToPt) → `../../units`
- reportPdfShared (COLOR/FONT/STATUS) → `../reportPdfShared`
- reportModel (sizeLabel/lookLabel) → `../reportModel`
- reportTypes (ReportProduct/ReportLook/ReportShotStatus) → `../reportTypes`
- `@react-pdf/renderer` → package import (the ONLY adapter that imports it)

DOM adapter at `components/report/primitives/<Name>.tsx`:
- the deriver + dom render → `../../../lib/report/primitives/<name>`
- reportTypes → `../../../lib/report/reportTypes`

Parity test at `lib/report/primitives/__tests__/<name>.parity.test.tsx`:
- deriver/spec/pdf-render → `../<name>`
- units → `../../../units`
- DOM adapter → `../../../../components/report/primitives/<Name>`
- reportTypes → `../../../reportTypes`
- reportModel → `../../../reportModel`

## 3. Mirror the Divider template EXACTLY (the proven 5-part shape)
Reference files (read them; do not modify):
- `src-vnext/features/export/lib/blockSpec.ts` — spec + `const` defaults + pure deriver
- `src-vnext/features/export/lib/specAdapters/dom.tsx` — `renderBlockSpecDom(spec): React.ReactElement`, defaultless `switch(spec.kind)`, inline px strings, `data-testid`
- `src-vnext/features/export/lib/pdf/specAdapters/pdf.tsx` — `renderBlockSpecPdf(spec): React.ReactElement`, imports `@react-pdf/renderer`, wraps every px in `pxToPt`, raw color
- `src-vnext/features/export/lib/units.ts` — `pxToPt = (px) => (px*72)/96`
- `src-vnext/features/export/lib/__tests__/blockSpec.parity.test.ts` — Layer 1
- `src-vnext/features/export/lib/pdf/blocks/__tests__/blockConsumers.parity.test.tsx` — Layer 2 + the @react-pdf mock
- `src-vnext/features/export/components/blocks/DividerBlockView.tsx`, `src-vnext/features/export/lib/pdf/blocks/DividerBlockPdf.tsx` — thin wrappers

Adaptation for co-located layout: put spec + deriver + BOTH `render<Name>Dom` and `render<Name>Pdf` — no wait: keep the render functions where they can import their renderer. **`render<Name>Pdf` (imports `@react-pdf`) lives in `lib/report/primitives/<name>.tsx` alongside spec+deriver. `render<Name>Dom` (pure JSX, no `@react-pdf`) ALSO lives there** — DOM JSX has no `@react-pdf` import so it does not pollute the lazy chunk; the Divider keeps DOM render in `lib/specAdapters/dom.tsx`, so put the DOM render in the same primitive file and have the `components/report/primitives/<Name>.tsx` be the thin wrapper that calls `derive<Name>Spec` + `render<Name>Dom`. (Rationale: only the `@react-pdf/renderer` import must stay out of the DOM bundle; the primitive file is imported by the PDF wrapper regardless, and the DOM wrapper imports the same file — tree-shaking keeps the PDF-render function out of the DOM bundle because it is a separate named export. If bundle-purity flags this in review, split `render<Name>Dom` into `components/report/primitives/<Name>.tsx` directly, matching Divider's split precisely.)

**RECOMMENDED (matches Divider split byte-for-byte):** DOM render function lives IN the DOM adapter file `components/report/primitives/<Name>.tsx`; the primitive `lib/report/primitives/<name>.tsx` holds spec + `const` tokens + deriver + `render<Name>Pdf`. This is the safest mirror. Use this split.

## 4. px → pt convention (verified nuance — READ THIS)
The **Divider** authors px-canonical and runs every px through `pxToPt` (0.75×). BUT the **report PDFs are hand-tuned in raw points at ~0.5× of DOM px** (e.g. DOM family 13px ↔ PDF family 7.5pt; DOM dot 5px ↔ PDF dot 5pt; DOM 9px tag ↔ PDF 5.5pt tag). These are NOT `px*0.75`. Forcing `pxToPt` would change shipped PDF sizes → not byte-identical at adoption.

**Convention for these primitives:** the spec carries BOTH `domPx` and an explicit `pdfPt` for every size/geometry field that diverges (font sizes, dot dims, border widths, letter-spacing). The DOM adapter emits `${domPx}px` strings; the PDF adapter emits the raw `pdfPt` number. `pxToPt` is STILL imported and used only where a value is genuinely a px→pt conversion (none of the report primitives need it for the shipped values; keep the import + a Layer-1 assertion `expect(pxToPt(96)).toBe(72)` / `toBeCloseTo(pxToPt(1),0.75)` in EVERY test to preserve the template's proof and prevent lint-unused). Colors are NEVER unit-converted on either side (raw hex to PDF; jsdom normalizes to rgb() on DOM).

Spec field naming: use `<field>DomPx` and `<field>Pt` pairs (e.g. `dotDomPx: 5`, `dotPt: 5`; `fontDomPx: 13`, `fontPt: 7.5`). This makes the two adapters provably consume ONE source and the parity test asserts DOM against `*DomPx` and PDF against `*Pt`.

## 5. Shared modules (scaffold)

### `qtyGlyph.ts` (verbatim)
```ts
// Canonical pending-qty glyph. Kills the image-led "×—"; "—" wins.
export function qtyGlyph(qty: number | null): string {
  return qty != null ? `×${String(qty)}` : "—"
}
```

### `primitiveTokens.ts`
Central re-export of the canonical dot-color map + any shared canonical constants, so StatusChip/HoldFlag/HeroMark resolve from one place. `STATUS_COLOR` is module-PRIVATE in `reportPdfShared.ts` (NOT exported) — but the exported `STATUS` record carries `.color` per status. So:
```ts
import { STATUS } from "../reportPdfShared"           // exported; STATUS[s].color = the reserved dot color
import type { ReportShotStatus } from "../reportTypes"

// PDF status dot colors — reserved green/amber/blue/gray, on_hold AMBER, never red.
// (Re-resolved from the shared STATUS record so we never re-hardcode the palette.)
export const STATUS_DOT_PT: Record<ReportShotStatus, string> = {
  complete: STATUS.complete.color,     // #16A34A
  in_progress: STATUS.in_progress.color, // #2563EB
  todo: STATUS.todo.color,             // #A1A1AA
  on_hold: STATUS.on_hold.color,       // #D97706 (AMBER)
}

// DOM status dot class names (existing CSS, unchanged) — the DOM side re-uses
// the shipped .sb-status--* rules so DOM color stays byte-identical (OKLCH).
export const STATUS_DOT_CLASS: Record<ReportShotStatus, string> = {
  complete: "sb-status--complete",
  in_progress: "sb-status--progress",
  todo: "sb-status--todo",
  on_hold: "sb-status--hold",
}

// The ONE sanctioned red (HoldFlag only).
export const HOLD_RED_HEX = "#EB1400"        // PDF: === COLOR.accent
export const HOLD_RED_VAR = "var(--sb-red)"  // DOM

// Canonical ink (HeroMark tag/dot, UnresolvedBadge border+text).
export const INK_HEX = "#18181B"             // PDF: === COLOR.text
export const INK_VAR = "var(--sb-ink)"       // DOM
```
Rationale for referencing the shared `STATUS`: keeps the reserved palette single-sourced; on_hold stays AMBER `#D97706`, never red — no color change vs today (per locked decision #5).

**DOM color parity note (CRITICAL for tests):** the DOM side of StatusChip uses OKLCH via the existing `.sb-status--*` classes, but jsdom does NOT resolve CSS-class colors to inline `.style` (the parity mock has no stylesheet). Therefore StatusChip's DOM adapter must render the dot color as an **inline `background` style** to be assertable, and it must match the shipped OKLCH strings EXACTLY. Put the OKLCH dot colors as canonical DOM tokens in `primitiveTokens.ts`:
```ts
export const STATUS_DOT_OKLCH: Record<ReportShotStatus, string> = {
  complete: "oklch(0.62 0.13 150)",
  in_progress: "oklch(0.62 0.13 240)",
  todo: "oklch(0.72 0.008 55)",   // === --sb-ink-disabled
  on_hold: "oklch(0.74 0.14 75)", // AMBER
}
```
The DOM adapter renders `style={{ background: STATUS_DOT_OKLCH[status], ... }}` PLUS the `STATUS_DOT_CLASS[status]` className (belt-and-suspenders; the inline style is what the test reads, the class is what a real page reads). jsdom keeps `oklch(...)` verbatim in `.style.background` (it does not normalize oklch), so the DOM parity assertion is `expect(dot.style.background).toBe(STATUS_DOT_OKLCH[status])`. **This dual color space (DOM oklch / PDF hex) means the StatusChip + HoldFlag parity tests do NOT cross-compare DOM color to PDF color** — each side is asserted against its own canonical token (`STATUS_DOT_OKLCH` vs `STATUS_DOT_PT`). Only primitives whose canonical color is a hex on BOTH sides (HeroMark ink dot/tag, UnresolvedBadge ink, HoldFlag red) use the `hexToRgb`+`normColor` cross-normalization from the template.

### `index.ts` (barrel)
Re-export all six specs, derivers, both render fns, and both wrapper components, plus `qtyGlyph` and the token maps:
```ts
export * from "./qtyGlyph"
export * from "./primitiveTokens"
export * from "./heroMark"
export * from "./statusChip"
export * from "./holdFlag"
export * from "./unresolvedBadge"
export * from "./lookLabel"
export * from "./productRow"
export { HeroMarkView } from "../../../components/report/primitives/HeroMark"
export { StatusChipView } from "../../../components/report/primitives/StatusChip"
export { HoldFlagView } from "../../../components/report/primitives/HoldFlag"
export { UnresolvedBadgeView } from "../../../components/report/primitives/UnresolvedBadge"
export { LookLabelView } from "../../../components/report/primitives/LookLabel"
export { ProductRowView, ProductColHeadView } from "../../../components/report/primitives/ProductRow"
```
The barrel is the ONLY thing that pulls DOM wrappers into `lib/` — keep it type-only-safe by NOT importing `@react-pdf` transitively into a DOM path (the DOM wrappers do not import `@react-pdf`; the PDF render fns in the primitive files do — a DOM consumer of the barrel that only touches `*View` still tree-shakes the PDF render out because it is a distinct named export). If review flags the barrel co-mingling DOM+PDF, split into `index.dom.ts` / `index.pdf.ts`; default to the single barrel.

## 6. @react-pdf MOCK — reuse VERBATIM (trim to elements used)
Every parity test opens with this top-of-file `vi.mock` BEFORE component imports. Include ONLY the elements the primitive renders (`View`+`StyleSheet` minimum; add `Text` for anything with a label/tag; `Image` only if a primitive renders an image — none of these six do, so omit `Image`). `StyleSheet: { create: (s)=>s }` always required.

```tsx
import { describe, it, expect, vi } from "vitest"

vi.mock("@react-pdf/renderer", () => {
  const React = require("react")
  const ser = (s: unknown) => {
    try {
      return s == null ? undefined : JSON.stringify(s)
    } catch {
      return undefined
    }
  }
  return {
    Text: (props: Record<string, unknown>) => {
      const { style, children, ...rest } = props as {
        style?: unknown; children?: unknown
      } & Record<string, unknown>
      return React.createElement("pdf-text", { ...rest, "data-style": ser(style) }, children as React.ReactNode)
    },
    View: (props: Record<string, unknown>) => {
      const { style, children, ...rest } = props as {
        style?: unknown; children?: unknown
      } & Record<string, unknown>
      return React.createElement("pdf-view", { ...rest, "data-style": ser(style) }, children as React.ReactNode)
    },
    StyleSheet: { create: (s: unknown) => s },
  }
})
```
Then, AFTER the mock: `import { render } from "@testing-library/react"`, import the wrapper components + deriver + tokens.

## 7. Parity-test recipe (two layers, per primitive)

### Helpers (verbatim from the template — include in every test)
```tsx
function parseStyle(el: Element | null): Record<string, unknown> {
  const raw = el?.getAttribute("data-style")
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
}
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`
}
const normColor = (c: string): string => c.replace(/\s+/g, "").toLowerCase()
```

### Layer 1 — spec snapshot (mirror `blockSpec.parity.test.ts`)
1. **Bare/default input → full `.toEqual({...})` snapshot** of the resolved spec (locks canonical `const` defaults as an owned diff).
2. **Explicit input → `.toMatchObject`** (pass-through proof).
3. **Non-mutation** via `structuredClone(input)` before, `.toEqual(before)` after.
4. **`pxToPt` physical-constant proof** (keeps the template invariant + prevents unused import): `expect(pxToPt(96)).toBe(72)`, `expect(pxToPt(1)).toBeCloseTo(0.75)`.

### Layer 2 — cross-renderer parity (mirror `blockConsumers.parity.test.tsx`)
- `CASES: readonly <Input>[]` array (bare, explicit, and edge variants — e.g. hero true/false, each status, hold true/false, pending qty, empty colour/style).
- `describe(...)` with two `it.each(CASES)` blocks: one renders `<Name>View`, queries DOM, asserts against `derive<Name>Spec(input)` (`*DomPx` fields, oklch/rgb color); the other renders `<Name>Pdf`, `parseStyle`s the mock element, asserts against the SAME derived spec (`*Pt` fields, hex color).
- **Numbers:** DOM px strings asserted EXACTLY (`toBe(\`${n}px\`)`); PDF pt asserted with `toBeCloseTo(pt)` (floats).
- **Color:** for ink/red hex primitives, DOM `normColor(el.style.X)` vs `normColor(hexToRgb(spec.hex))`, PDF `String(style.X).toLowerCase()` vs `spec.hex.toLowerCase()`. For StatusChip/HoldFlag-dot (oklch DOM, hex PDF) assert each side against its own token (no cross-compare).
- The two blocks together prove neither renderer re-derives — both consume `derive<Name>Spec`.

## 8. Where each primitive's canonical values come from (single-source)
- **PDF:** reuse `COLOR` (`text=#18181B`, `accent=#EB1400`, `textSecondary=#52525B`, `textSubtle=#5B5B60`, `textDisabled=#A1A1AA`, `surfaceSubtle=#F4F4F5`, `rule=#E4E4E7`) and `FONT` (`uiBold`=Helvetica-Bold, `ui`/`body`=Helvetica, `bodyItalic`=Helvetica-Oblique) from `../reportPdfShared`. Reserved status dot palette via the exported `STATUS[s].color`.
- **DOM:** emit the existing CSS-var strings (`var(--sb-ink)`, `var(--sb-ink-2)`, `var(--sb-ink-3)`, `var(--sb-ink-disabled)`, `var(--sb-red)`, `var(--sb-rule)`) and type-scale px (3xs 9 / 2xs 10 / xs 12 / sm 13) as inline styles + reuse the shipped `.sb-status--*` classes. Do NOT invent new CSS or edit `reportStyles.ts`.
- **Canonicalize (per locked decisions) only:** HeroMark → INK dot + BOLD + uppercase INK "HERO" (kill red rail/tag + ▲ + mixed-case " Hero"); HoldFlag → the sole RED; StatusChip on_hold dot → AMBER (already is); UnresolvedBadge → INK (demote from red-ink `--sb-red-ink`/`accentInk`); qty pending → "—" (kill "×—"); Everything else = keep today's look via per-host props.

## 9. Byte-identical safety check before wrap
Because primitives land UNUSED, prove no existing renderer imports them:
```
grep -rn "report/primitives" src-vnext/features/export --include=*.tsx --include=*.ts | grep -v "/primitives/"
```
Must return ONLY the barrel/test lines, never a renderer/style file. Confirm `npm run build` and `npm run typecheck:baseline` stay green and no baseline error count change.


## Per-primitive

### HeroMark (heroMark)
**Spec:** ```ts
export interface HeroMarkSpec {
  readonly kind: "heroMark"
  readonly isHero: boolean
  // dot geometry (ink round dot)
  readonly dotDomPx: number   // 5
  readonly dotPt: number      // 5
  // "HERO" tag
  readonly tagText: string    // "HERO" (uppercase, canonical)
  readonly tagFontDomPx: number  // 9  (--sb-t-3xs)
  readonly tagFontPt: number     // 5.5
  readonly tagLetterSpacingDomEm: number // 0.08
  readonly tagLetterSpacingPt: number    // 0.8
  readonly familyBoldWhenHero: boolean   // true -> weight 600 DOM / FONT.uiBold PDF
}

// Input: caller passes just the hero flag (from ReportProduct.isHero).
export interface HeroMarkInput { readonly isHero: boolean }
```
Colors are NOT spec fields — they are the fixed canonical INK constants (`INK_VAR` DOM / `COLOR.text` PDF) applied in the adapters, since HeroMark is color-invariant by decision (no red, ever).
**Deriver:** `export function deriveHeroMarkSpec(input: HeroMarkInput): HeroMarkSpec` — PURE, no mutation, returns a new object. Resolves all geometry from module-level canonical `const`s (`HERO_DOT_DOM_PX=5`, `HERO_DOT_PT=5`, `HERO_TAG_TEXT="HERO"`, `HERO_TAG_FONT_DOM_PX=9`, `HERO_TAG_FONT_PT=5.5`, `HERO_TAG_LS_DOM_EM=0.08`, `HERO_TAG_LS_PT=0.8`). Sets `isHero: input.isHero`, `familyBoldWhenHero: true`. Nothing is derived from color (canonical ink is constant). Signature mirrors `deriveDividerSpec`.
**DOM:** DOM adapter `render HeroMarkDom(spec): React.ReactElement`, defaultless `switch(spec.kind)`. When `!spec.isHero` return an empty `<span data-testid="hero-mark" data-hero="false" />` (renders nothing visible — self-contained; conditional render, NOT visibility:hidden). When hero, return a `<span data-testid="hero-mark" data-hero="true">` containing: (1) the INK dot `<span data-testid="hero-dot" style={{ width:'5px', height:'5px', borderRadius:'50%', background:'var(--sb-ink)', display:'inline-block', alignSelf:'center', marginTop:'1px' }} />`; (2) the tag `<span data-testid="hero-tag" style={{ fontFamily:'var(--sb-font-ui)', fontSize:'9px', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--sb-ink)' }}>HERO</span>`. Family-bold is applied by the CONSUMER (ProductRow) via `familyBoldWhenHero`; HeroMark itself owns dot+tag. Every value inline from the spec (`${spec.dotDomPx}px`, `${spec.tagFontDomPx}px`, `${spec.tagLetterSpacingDomEm}em`).
**PDF:** PDF adapter `render HeroMarkPdf(spec): React.ReactElement` (imports `View`,`Text` from `@react-pdf/renderer`), defaultless `switch(spec.kind)`. When `!spec.isHero` return `<View />` (empty; nothing painted). When hero return a `<View>` wrapper containing: (1) ink dot `<View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:COLOR.text }} />` (dotPt=5 → radius 2.5); (2) tag `<Text style={{ fontFamily:FONT.uiBold, fontSize:5.5, letterSpacing:0.8, textTransform:'uppercase', color:COLOR.text }}>{'  HERO'}</Text>` (two-space lead preserves shipped balanced-rows spacing; color swapped accent→COLOR.text per decision). Reuse `COLOR`/`FONT` from `../reportPdfShared`.
**Test:** Mock: View+Text+StyleSheet. Layer 1: `deriveHeroMarkSpec({isHero:true})` → full `.toEqual` snapshot (dotDomPx5/dotPt5/tagText'HERO'/fonts/ls/familyBoldWhenHero true); `{isHero:false}` → same geometry but `isHero:false`; non-mutation via structuredClone; pxToPt constant proof. Layer 2 CASES=[{isHero:true},{isHero:false}]. hero=true: DOM asserts `hero-dot` width/height '5px', background 'var(--sb-ink)' (jsdom keeps the CSS var verbatim), borderRadius '50%'; `hero-tag` textContent 'HERO', color normColor vs hexToRgb('#18181B') — NOTE jsdom leaves `var(--sb-ink)` unresolved so assert the raw string `dot.style.background === 'var(--sb-ink)'` and `tag.style.color === 'var(--sb-ink)'` (CSS vars don't resolve in jsdom); PDF asserts pdf-view dot width/height 5, borderRadius 2.5, backgroundColor lowercased === '#18181b', pdf-text textContent contains 'HERO', color '#18181b', fontSize toBeCloseTo 5.5. hero=false: DOM `hero-mark` has data-hero='false' and no `hero-dot`; PDF pdf-view has no child dot/text.


### StatusChip (statusChip)
**Spec:** ```ts
import type { ReportShotStatus } from "../reportTypes"
export interface StatusChipSpec {
  readonly kind: "statusChip"
  readonly status: ReportShotStatus
  readonly label: string          // caller-supplied (legacy for image-led, canonical for recipes)
  // dot color resolved from the reserved set (never red; on_hold AMBER)
  readonly dotOklch: string       // DOM  (STATUS_DOT_OKLCH[status])
  readonly dotHex: string         // PDF  (STATUS[status].color)
  readonly dotDomClass: string    // STATUS_DOT_CLASS[status]
  // per-host metrics (kept overridable so each host stays byte-identical)
  readonly labelFontDomPx: number // default 10 (image-led/balanced); 9 for production inline
  readonly labelFontPt: number    // default 7 (image-led); 6 for recipes
  readonly labelLetterSpacingDomEm: number // 0.06 default (image-led) / 0.08 recipes
  readonly labelLetterSpacingPt: number    // 0.5
  readonly labelColorVar: string  // DOM: 'var(--sb-ink-2)' default / 'var(--sb-ink-3)' production inline
  readonly labelColorHex: string  // PDF: COLOR.textSecondary default / COLOR.textSubtle production inline
  readonly dotDomPx: number       // 7 (DOM established size)
  readonly dotPt: number          // 5
}
export interface StatusChipInput {
  readonly status: ReportShotStatus
  readonly label: string
  readonly variant?: "imageLed" | "balanced" | "productionInline"  // selects the per-host metric preset
}
```
**Deriver:** `export function deriveStatusChipSpec(input: StatusChipInput): StatusChipSpec` — PURE. Resolves dot colors from the shared reserved set: `dotOklch = STATUS_DOT_OKLCH[input.status]`, `dotHex = STATUS[input.status].color`, `dotDomClass = STATUS_DOT_CLASS[input.status]` (all from `primitiveTokens`/`reportPdfShared` — on_hold = AMBER #D97706, NEVER red). `label` passes through verbatim (NOT derived). Metric fields resolved from a `variant`→preset map (module-level `const STATUS_PRESETS`): imageLed {fontDomPx10, fontPt7, lsDomEm0.06, lsPt0.5, colorVar'var(--sb-ink-2)', colorHex COLOR.textSecondary}; balanced {fontDomPx10, fontPt6, lsDomEm0.08, lsPt0.5, colorVar'var(--sb-ink-2)', colorHex COLOR.textSecondary}; productionInline {fontDomPx9, fontPt6, lsDomEm0.08, lsPt0.5, colorVar'var(--sb-ink-3)', colorHex COLOR.textSubtle}. Default variant='imageLed'. dotDomPx=7, dotPt=5 constant. No mutation.
**DOM:** `render StatusChipDom(spec): React.ReactElement`, defaultless `switch`. `<span data-testid="status-chip" className={\`sb-status-chip \`} style={{ display:'inline-flex', alignItems:'center', gap:'7px', fontFamily:'var(--sb-font-ui)', fontSize:\`${spec.labelFontDomPx}px\`, fontWeight:600, letterSpacing:\`${spec.labelLetterSpacingDomEm}em\`, textTransform:'uppercase', color:spec.labelColorVar }}>` containing: dot `<span data-testid="status-dot" className={spec.dotDomClass} style={{ width:'7px', height:'7px', borderRadius:'50%', display:'inline-block', background:spec.dotOklch }} />` (inline oklch so the test can read it; class also applied for real-page fidelity) + label `<span data-testid="status-label">{spec.label}</span>`. All metrics inline from spec.
**PDF:** `render StatusChipPdf(spec): React.ReactElement` (imports View,Text). `<View data-testid style={{ flexDirection:'row', alignItems:'center' }}>` containing dot `<View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:spec.dotHex, marginRight:5 }} />` + label `<Text style={{ fontFamily:FONT.uiBold, fontSize:spec.labelFontPt, letterSpacing:spec.labelLetterSpacingPt, textTransform:'uppercase', color:spec.labelColorHex }}>{spec.label}</Text>`. Margins around the whole chip (marginRight14 image-led / marginLeft10 balanced etc.) are LAYOUT and stay with the host wrapper — NOT baked in. dotHex from STATUS[status].color (verbatim reserved palette).
**Test:** Mock: View+Text+StyleSheet. Layer 1: for each of the 4 statuses derive and `.toMatchObject` the resolved dotHex (`#16A34A`/`#2563EB`/`#A1A1AA`/`#D97706`) + dotOklch; snapshot one full spec for variant='imageLed'; assert on_hold dotHex==='#D97706' (AMBER, not red) explicitly; label pass-through ('Shot' legacy vs canonical); variant preset resolution (productionInline → fontDomPx9/colorVar ink-3); non-mutation; pxToPt proof. Layer 2 CASES = the 4 statuses × 2 label sets (legacy+canonical) × a couple variants. DOM: assert `status-dot`.style.background === spec.dotOklch (jsdom keeps oklch verbatim), status-label textContent === spec.label, chip fontSize `${spec.labelFontDomPx}px`. PDF: pdf-view dot backgroundColor lowercased === spec.dotHex.toLowerCase(), pdf-text textContent === spec.label, fontSize toBeCloseTo spec.labelFontPt. IMPORTANT: do NOT cross-compare DOM oklch to PDF hex (different color spaces by design) — assert each against its own token.


### HoldFlag (holdFlag)
**Spec:** ```ts
import type { ReportShotStatus } from "../reportTypes"
export interface HoldFlagSpec {
  readonly kind: "holdFlag"
  readonly hold: boolean
  readonly labelText: string          // "HOLD" (uppercase canonical)
  readonly railWidthDomPx: number     // 4 (shipped DOM rail)
  readonly railWidthPt: number        // 3 (shipped PDF rail)
  readonly redHex: string             // "#EB1400"  (=== COLOR.accent) — the ONE sanctioned red
  readonly redVar: string             // "var(--sb-red)"
  readonly labelFontDomPx: number     // 9  (--sb-t-3xs)
  readonly labelFontPt: number        // 5
  readonly labelLetterSpacingDomEm: number // 0.14
  readonly labelLetterSpacingPt: number    // 0.5
  readonly orientation: "vertical" | "horizontal"  // vertical = production-sheet spine (default)
}
export interface HoldFlagInput {
  readonly status: ReportShotStatus
  readonly orientation?: "vertical" | "horizontal"
}
```
HoldFlag is the ONLY primitive allowed to emit #EB1400 / var(--sb-red).
**Deriver:** `export function deriveHoldFlagSpec(input: HoldFlagInput): HoldFlagSpec` — PURE. `hold = input.status === "on_hold"` (mirrors shipped `isFlagged`). All geometry from module `const`s: `HOLD_LABEL='HOLD'`, `HOLD_RAIL_DOM_PX=4`, `HOLD_RAIL_PT=3`, red from `HOLD_RED_HEX='#EB1400'`/`HOLD_RED_VAR='var(--sb-red)'`, `HOLD_LABEL_FONT_DOM_PX=9`, `HOLD_LABEL_FONT_PT=5`, `HOLD_LABEL_LS_DOM_EM=0.14`, `HOLD_LABEL_LS_PT=0.5`. `orientation = input.orientation ?? "vertical"`. Returns a fully-populated spec even when `!hold` (adapters gate on `spec.hold`), so the Layer-1 snapshot is stable. No mutation.
**DOM:** `render HoldFlagDom(spec): React.ReactElement`, defaultless switch. When `!spec.hold` return `<span data-testid="hold-flag" data-hold="false" />` (NO rail, NO text, NO reserved space). When hold, return `<span data-testid="hold-flag" data-hold="true">` with: rail `<span data-testid="hold-rail" style={{ display:'inline-block', width:'4px', alignSelf:'stretch', background:'var(--sb-red)' }} />` (the shipped production-sheet 4px full-height red rail; expressed as an inline-block bar so it is host-orientation-agnostic) + label `<span data-testid="hold-label" style={{ fontFamily:'var(--sb-font-ui)', fontWeight:700, fontSize:'9px', letterSpacing:'0.14em', textTransform:'uppercase', color:'var(--sb-red)', ...(spec.orientation==='vertical' ? { writingMode:'vertical-rl', transform:'rotate(180deg)' } : {}) }}>HOLD</span>`. The vertical writing-mode is applied only for orientation='vertical' (production-sheet spine); horizontal omits it. Color = var(--sb-red) on both marks.
**PDF:** `render HoldFlagPdf(spec): React.ReactElement` (imports View,Text). When `!spec.hold` return `<View />`. When hold return `<View data-testid style={{ borderLeftWidth:3, borderLeftColor:COLOR.accent }}>` (3pt red left rail, the shipped production-sheet value) containing `<Text style={{ fontFamily:FONT.uiBold, fontSize:5, letterSpacing:0.5, textTransform:'uppercase', color:COLOR.accent }}>HOLD</Text>`. `COLOR.accent === '#EB1400'` (verified). @react-pdf has no writing-mode; vertical orientation is a host layout concern in adoption, so the PDF label is always horizontal 'HOLD' (matches shipped `holdTxt`).
**Test:** Mock: View+Text+StyleSheet. Layer 1: `deriveHoldFlagSpec({status:'on_hold'})` → full `.toEqual` (hold true, labelText'HOLD', railWidthDomPx4/railWidthPt3, redHex'#EB1400', fonts, orientation'vertical'); `{status:'complete'}` → identical geometry but hold=false; orientation override → 'horizontal'; assert redHex==='#EB1400' AND that this is the ONLY primitive spec carrying it; non-mutation; pxToPt proof. Layer 2 CASES=[{status:'on_hold'},{status:'todo'},{status:'on_hold',orientation:'horizontal'}]. hold: DOM `hold-rail` width '4px' background 'var(--sb-red)', `hold-label` textContent 'HOLD' color 'var(--sb-red)', vertical case has writingMode 'vertical-rl'; PDF pdf-view borderLeftWidth toBeCloseTo 3, borderLeftColor lowercased '#eb1400', pdf-text textContent 'HOLD' color '#eb1400' fontSize toBeCloseTo 5. not-hold: DOM `hold-flag` data-hold='false' and no rail/label; PDF pdf-view empty (no children).


### UnresolvedBadge (unresolvedBadge)
**Spec:** ```ts
export interface UnresolvedBadgeSpec {
  readonly kind: "unresolvedBadge"
  readonly label: string              // caller: "Unresolved" | "Mixed" | "Gender ?"
  readonly inkHex: string             // "#18181B" (=== COLOR.text) — demoted from accentInk
  readonly inkVar: string             // "var(--sb-ink)" — demoted from --sb-red-ink
  readonly fontDomPx: number          // 9 (--sb-t-3xs)
  readonly fontPt: number             // 5.5
  readonly letterSpacingDomEm: number // 0.06
  readonly letterSpacingPt: number    // 0.4
  readonly paddingDomPx: string       // "1px 4px"
  readonly paddingHorizontalPt: number // 3
  readonly borderRadiusDomPx: number  // 2
  readonly borderRadiusPt: number     // 1
  readonly borderWidthPt: number      // 0.5
}
export interface UnresolvedBadgeInput { readonly label: string }
```
**Deriver:** `export function deriveUnresolvedBadgeSpec(input: UnresolvedBadgeInput): UnresolvedBadgeSpec` — PURE. `label` passes through. All color = INK constants (`INK_HEX='#18181B'`, `INK_VAR='var(--sb-ink)'`) — the DEMOTION from red-ink (was `--sb-red-ink`/`accentInk #B3261E`). Geometry from module `const`s: fontDomPx9/fontPt5.5, lsDomEm0.06/lsPt0.4, paddingDomPx'1px 4px'/paddingHorizontalPt3 (recommended single padding), borderRadiusDomPx2/borderRadiusPt1, borderWidthPt0.5. No mutation. Margins are LAYOUT (host-owned), not in the spec.
**DOM:** `render UnresolvedBadgeDom(spec): React.ReactElement`, defaultless switch. `<span data-testid="unresolved-badge" style={{ fontFamily:'var(--sb-font-ui)', fontSize:'9px', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--sb-ink)', border:'1px solid currentColor', borderRadius:'2px', padding:'1px 4px', lineHeight:1.2, display:'inline-block' }}>{spec.label}</span>`. `border:1px solid currentColor` + `color:var(--sb-ink)` = ink border follows ink text (mirrors the shipped `.sb-badge-unresolved` structure, only the color token demoted). Do NOT add the `sb-badge-unresolved` class (that class still points at red-ink in the untouched stylesheet; the primitive is fully inline so it stays byte-controllable and doesn't inherit the old red).
**PDF:** `render UnresolvedBadgePdf(spec): React.ReactElement` (imports Text; no View needed). `<Text data-testid style={{ fontFamily:FONT.uiBold, fontSize:5.5, letterSpacing:0.4, textTransform:'uppercase', color:COLOR.text, borderWidth:0.5, borderColor:COLOR.text, borderRadius:1, paddingHorizontal:3 }}>{spec.label}</Text>`. `color`+`borderColor` both COLOR.text (#18181B) — the demotion from `accentInk #B3261E`. marginLeft/marginRight left to host.
**Test:** Mock: Text+StyleSheet (no View/Image). Layer 1: derive for label 'Gender ?' → full `.toEqual` snapshot; explicitly assert inkHex==='#18181B' and NOT '#B3261E'/red-ink (the demotion); label pass-through for 'Unresolved'/'Mixed'/'Gender ?'; non-mutation; pxToPt proof. Layer 2 CASES=[{label:'Unresolved'},{label:'Mixed'},{label:'Gender ?'}]. DOM: `unresolved-badge` textContent === label, color normColor vs hexToRgb('#18181B') (jsdom resolves `var(--sb-ink)`? — it does NOT; so assert raw `badge.style.color === 'var(--sb-ink)'` and `badge.style.borderColor`/border contains 'currentColor'), fontSize '9px', textTransform 'uppercase'. PDF: pdf-text textContent === label, color lowercased '#18181b', borderColor '#18181b', borderWidth toBeCloseTo 0.5, fontSize toBeCloseTo 5.5.


### LookLabel (lookLabel)
**Spec:** ```ts
export interface LookLabelSpec {
  readonly kind: "lookLabel"
  readonly label: string              // verbatim from ReportLook.label (NOT .toUpperCase'd in JS)
  readonly isAlt: boolean
  readonly variant: "rule" | "chip"   // rule = image-led (flex rule line, no count); chip = ps/br (bordered count tag)
  readonly countText: string | null   // null when no count; else "1 piece" | "N pieces"
  // label metrics
  readonly labelFontDomPx: number     // 10 (2xs) rule; 9 (3xs) chip-ps... use 10 canonical, see note
  readonly labelFontPt: number        // 7 rule; 6.5 chip
  readonly labelLetterSpacingDomEm: number // 0.12
  readonly labelLetterSpacingPt: number    // 1 (rule) / 0.8 (chip)
  readonly labelColorVar: string      // primary 'var(--sb-ink)' ; alt 'var(--sb-ink-2)'
  readonly labelColorHex: string      // primary COLOR.text ; alt COLOR.textSecondary
  // count chip metrics (chip variant only)
  readonly countFontDomPx: number     // 9
  readonly countFontPt: number        // 5.5
  readonly countColorVar: string      // 'var(--sb-ink-3)'
  readonly countColorHex: string      // COLOR.textSubtle
}
export interface LookLabelInput {
  readonly label: string
  readonly isAlt: boolean
  readonly pieceCount?: number         // undefined -> rule variant; defined -> chip variant
  readonly variantOverride?: "rule" | "chip"
}
```
**Deriver:** `export function deriveLookLabelSpec(input: LookLabelInput): LookLabelSpec` — PURE. `label` verbatim (casing done in CSS/PDF `textTransform`, NEVER `.toUpperCase()` in JS — kills the production-sheet fork). `isAlt` passes through. `variant = input.variantOverride ?? (input.pieceCount === undefined ? "rule" : "chip")`. `countText = input.pieceCount === undefined ? null : (input.pieceCount === 1 ? "1 piece" : \`${input.pieceCount} pieces\`)`. Alt tint canonicalized: `labelColorVar = isAlt ? 'var(--sb-ink-2)' : 'var(--sb-ink)'`, `labelColorHex = isAlt ? COLOR.textSecondary : COLOR.text` (matches image-led + production-sheet; harmonizes balanced-rows' one-step-lighter start). Metrics from a variant preset `const`. No mutation.
**DOM:** `render LookLabelDom(spec): React.ReactElement`, defaultless switch. RULE variant: `<div data-testid="look-label" data-variant="rule" style={{ display:'flex', alignItems:'center' }}>` → label `<span data-testid="look-label-text" style={{ fontFamily:'var(--sb-font-ui)', fontSize:'10px', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:spec.labelColorVar }}>{spec.label}</span>` + rule line `<span data-testid="look-rule" style={{ flex:1, borderTop:'1px solid var(--sb-rule)', marginLeft:'8px' }} />`. CHIP variant: `<div data-testid="look-label" data-variant="chip" style={{ display:'inline-flex', alignItems:'center' }}>` → label span (same metrics, weight 700) + count `<span data-testid="look-count" style={{ fontSize:'9px', fontWeight:600, letterSpacing:'0.06em', color:'var(--sb-ink-3)', border:'1px solid var(--sb-rule)', borderRadius:'2px', padding:'0 5px', textTransform:'none', marginLeft:'6px' }}>{spec.countText}</span>` (textTransform:none so count stays '1 piece' not '1 PIECE'). Every metric inline from spec.
**PDF:** `render LookLabelPdf(spec): React.ReactElement` (imports View,Text). RULE: `<View data-testid style={{ flexDirection:'row', alignItems:'center' }}>` → `<Text style={{ fontFamily:FONT.uiBold, fontSize:7, letterSpacing:1, textTransform:'uppercase', color:spec.labelColorHex }}>{spec.label}</Text>` + `<View style={{ flex:1, height:0.5, backgroundColor:COLOR.rule, marginLeft:8 }} />`. CHIP: `<View data-testid style={{ flexDirection:'row', alignItems:'center' }}>` → label `<Text style={{ fontFamily:FONT.uiBold, fontSize:6.5, letterSpacing:0.8, textTransform:'uppercase', color:spec.labelColorHex }}>{spec.label}</Text>` + count `<Text style={{ fontFamily:FONT.ui, fontSize:5.5, color:COLOR.textSubtle, borderWidth:0.5, borderColor:COLOR.rule, borderRadius:1, paddingHorizontal:3, marginLeft:6 }}>{spec.countText}</Text>`. labelColorHex primary COLOR.text / alt COLOR.textSecondary.
**Test:** Mock: View+Text+StyleSheet. Layer 1: derive `{label:'Primary',isAlt:false}` (no pieceCount) → variant'rule', countText null, labelColorVar 'var(--sb-ink)' → full snapshot; `{label:'Alt 1',isAlt:true,pieceCount:3}` → variant'chip', countText '3 pieces', labelColorVar 'var(--sb-ink-2)'; `pieceCount:1` → countText '1 piece'; `variantOverride:'chip'` forces chip even without count; assert label is NEVER upper-cased in spec (spec.label === input.label verbatim); non-mutation; pxToPt proof. Layer 2 CASES cover rule (no count), chip (count 1 and N), primary vs alt. DOM: `look-label` data-variant matches; `look-label-text` textContent === spec.label (raw, un-uppercased) with textTransform 'uppercase' in style; rule variant has `look-rule`, no `look-count`; chip variant has `look-count` textContent === spec.countText with textTransform 'none'; alt asserts color 'var(--sb-ink-2)'. PDF: pdf-text label textContent === spec.label, color lowercased vs spec.labelColorHex; rule variant pdf-view rule bar backgroundColor '#e4e4e7'; chip count pdf-text textContent === spec.countText.


### ProductRow (productRow)
**Spec:** ```ts
import type { ReportProduct } from "../reportTypes"
export type ProductColumnSet = "compact" | "full"  // compact=image-led (style demoted to meta,5 col); full=ps/br (6 col incl Style)
export interface ProductRowSpec {
  readonly kind: "productRow"
  readonly family: string            // ReportProduct.family or 'Unnamed product'
  readonly style: string | null
  readonly colour: string | null
  readonly sizeText: string          // sizeLabel(...).text
  readonly sizePending: boolean      // sizeLabel(...).pending -> muted
  readonly qtyText: string           // qtyGlyph(qty)
  readonly isHero: boolean
  readonly columns: ProductColumnSet
  readonly colourPlaceholder: string // caller per-recipe ('Colour TBD' | 'Unspecified' | '—')
  readonly stylePlaceholder: string  // caller per-recipe ('—' | 'no style #')
  readonly familyPlaceholder: string // 'Unnamed product' (default)
}
export interface ProductRowInput {
  readonly product: ReportProduct
  readonly columns: ProductColumnSet
  readonly colourPlaceholder: string
  readonly stylePlaceholder: string
}
// Table header variant:
export interface ProductColHeadSpec {
  readonly kind: "productColHead"
  readonly columns: ProductColumnSet
  readonly headers: readonly string[]  // full: ['','Family','Style','Colour','Size','Qty']; compact: ['','Family','Colour','Size','Qty']
}
```
**Deriver:** TWO pure derivers in the file. `export function deriveProductRowSpec(input): ProductRowSpec`: `family = has(product.family) ? product.family : 'Unnamed product'`; `style`/`colour` pass through raw (placeholders applied in adapter when null/empty, using the caller-supplied strings so nothing is hardcoded); `{text:sizeText, pending:sizePending} = sizeLabel(product.sizeScope, product.size)` (import from `../reportModel`, KEEP its exact signature); `qtyText = qtyGlyph(product.qty)` (kills '×—'); `isHero = product.isHero`; `columns`, `colourPlaceholder`, `stylePlaceholder` pass through; `familyPlaceholder='Unnamed product'`. No mutation. `export function deriveProductColHeadSpec(columns): ProductColHeadSpec`: headers from a `const` map (full=['','Family','Style','Colour','Size','Qty'], compact=['','Family','Colour','Size','Qty']).
**DOM:** `render ProductRowDom(spec): React.ReactElement` + `render ProductColHeadDom(spec): React.ReactElement`, BOTH in defaultless switch on `spec.kind`. ProductRow renders a `<div data-testid="product-row" data-hero={String(spec.isHero)} data-columns={spec.columns} style={{ display:'grid', columnGap:'14px', gridTemplateColumns: spec.columns==='full' ? '14px minmax(0,1.7fr) minmax(96px,0.9fr) minmax(76px,0.9fr) minmax(64px,auto) 36px' : '14px minmax(0,1.55fr) minmax(0,1fr) 4.5rem 2.5rem' }}>` with cells: (1) hero cell = `render HeroMarkDom(deriveHeroMarkSpec({isHero:spec.isHero}))` (REUSE HeroMark primitive — ink dot); (2) family `<span data-testid="pr-family" style={{ fontFamily:'var(--sb-font-ui)', fontSize:'13px', color:'var(--sb-ink)', fontWeight: spec.isHero ? 600 : 400 }}>{spec.family}{spec.isHero ? <HERO tag> : null}</span>` (the HERO tag comes from HeroMark's tag; render `render HeroMarkDom` tag inline OR append the tag element — reuse HeroMark for the tag too); (3) [full only] style `<span data-testid="pr-style" style={{ fontSize:'12px', color:'var(--sb-ink-3)' }}>{has(spec.style)?spec.style:spec.stylePlaceholder}</span>`; (4) colour `<span data-testid="pr-colour" style={{ fontSize:'12px', color:'var(--sb-ink-2)' }}>{has(spec.colour)?spec.colour:spec.colourPlaceholder}</span>` (compact: colour is a cell; style folds into a `.meta` sub-line — for compact render style below family as a muted meta span); (5) size `<span data-testid="pr-size" style={{ fontSize:'12px', color: spec.sizePending ? 'var(--sb-ink-3)' : 'var(--sb-ink-2)', fontStyle: spec.sizePending ? 'italic':'normal', textAlign:'right' }}>{spec.sizeText}</span>`; (6) qty `<span data-testid="pr-qty" style={{ fontSize:'12px', color:'var(--sb-ink-3)', textAlign:'right' }}>{spec.qtyText}</span>`. ProductColHead renders a matching grid `<div data-testid="product-colhead">` of `<span>` headers 9px uiBold uppercase ls0.08em color var(--sb-ink-3), border-bottom 1px var(--sb-rule).
**PDF:** `render ProductRowPdf(spec): React.ReactElement` + `render ProductColHeadPdf(spec): React.ReactElement` (import View,Text). ProductRow `<View data-testid style={{ flexDirection:'row', paddingVertical:3.5, borderBottomWidth:0.5, borderBottomColor:COLOR.rule }}>` cells with widths: full → cHero{width:8}, cFam{flex:1.7}, cStyle{flex:0.9}, cColour{flex:0.9}, cSize{width:44,textAlign:'right'}, cQty{width:26,textAlign:'right'}; compact → cHero{width:8}, cFam{flex:1.55}, cColour{flex:1}, cStyle{width:60}, cSize{width:42,textAlign:'right'}, cQty{width:26,textAlign:'right'}. Hero cell = `render HeroMarkPdf(deriveHeroMarkSpec({isHero:spec.isHero}))` (ink dot). Family `<Text style={{ fontFamily: spec.isHero?FONT.uiBold:FONT.ui, fontSize:7.5, color:COLOR.text }}>{spec.family}</Text>` + hero tag via HeroMark. Style `<Text style={{ fontFamily:FONT.ui, fontSize:6.5, color:COLOR.textSecondary }}>{has(spec.style)?spec.style:spec.stylePlaceholder}</Text>`. Colour fs6.5 textSecondary. Size `<Text style={{ fontSize:6.5, color: spec.sizePending?COLOR.textSubtle:COLOR.text, fontFamily: spec.sizePending?FONT.bodyItalic:FONT.ui, textAlign:'right' }}>{spec.sizeText}</Text>`. Qty `<Text style={{ fontSize:6.5, color:COLOR.textSubtle, textAlign:'right' }}>{spec.qtyText}</Text>`. ProductColHead `<View>` row of `<Text>` fs5 uiBold uppercase color textSubtle, borderBottom 0.5 rule.
**Test:** Mock: View+Text+StyleSheet (no Image — ProductRow renders no image). Layer 1 (deriveProductRowSpec): bare product {qty:null,sizeScope:'pending',family:'',...} → full `.toEqual` snapshot asserting family 'Unnamed product', qtyText '—' (NOT '×—'), sizeText 'Pending' sizePending true; explicit product {qty:2,size:'M',sizeScope:'single',family:'Tee',isHero:true} → qtyText '×2', sizeText 'M', sizePending false, isHero true; assert `sizeLabel` signature is consumed unchanged (spy or value check for 'All sizes' via sizeScope:'all'); placeholders pass through; non-mutation via structuredClone(product); qtyGlyph unit cases (null→'—', 3→'×3'); pxToPt proof. deriveProductColHeadSpec: full→headers ['','Family','Style','Colour','Size','Qty']; compact→['','Family','Colour','Size','Qty']. Layer 2 CASES = matrix of {columns:'full'|'compact'} × {isHero t/f} × {qty null/2} × {colour ''/'Red'} × {sizeScope 'pending'/'single'}. DOM: `product-row` data-columns + gridTemplateColumns exact string; `pr-family` textContent === spec.family, fontWeight 600 when hero; hero cell contains HeroMark `hero-dot` when isHero (ink, background 'var(--sb-ink)') and NONE when !isHero; `pr-qty` textContent === spec.qtyText (asserts '—' never '×—'); `pr-colour` shows placeholder when empty; `pr-size` italic+ink-3 when pending. PDF: pdf-view row borderBottomWidth toBeCloseTo 0.5; family pdf-text fontFamily Helvetica-Bold when hero; qty pdf-text textContent === spec.qtyText; hero dot pdf-view backgroundColor '#18181b' present only when hero. Cross-check both adapters consume ONE deriveProductRowSpec (no re-derive).
