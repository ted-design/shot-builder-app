import { View, Text } from "@react-pdf/renderer"
import { COLOR, FONT } from "../reportPdfShared"

// Canonical HeroMark primitive — the hero indicator on a product row.
// ONE spec both adapters present, so the DOM preview and the @react-pdf export
// can't drift. HeroMark is color-INVARIANT by locked decision (2026-06-29): it
// is INK on every surface (round dot + BOLD family + uppercase INK "HERO" tag),
// never red, never a colour/status accent. Colours are therefore NOT spec fields
// — they are the fixed canonical INK constants applied in each adapter
// (`var(--sb-ink)` DOM / `COLOR.text` PDF).

export interface HeroMarkSpec {
  readonly kind: "heroMark"
  readonly isHero: boolean
  // dot geometry (ink round dot)
  readonly dotDomPx: number // 5
  readonly dotPt: number // 5
  // "HERO" tag
  readonly tagText: string // "HERO" (uppercase, canonical)
  readonly tagFontDomPx: number // 9 (--sb-t-3xs)
  readonly tagFontPt: number // 5.5
  readonly tagLetterSpacingDomEm: number // 0.08
  readonly tagLetterSpacingPt: number // 0.8
  readonly familyBoldWhenHero: boolean // true -> weight 600 DOM / FONT.uiBold PDF
}

// Input: caller passes just the hero flag (from ReportProduct.isHero).
export interface HeroMarkInput {
  readonly isHero: boolean
}

/** Discriminated-union of resolved primitive specs handled here. Single-variant
 * today; the defaultless `switch(spec.kind)` in each adapter stays exhaustive via
 * the explicit ReactElement return type (add a `never` default when it grows). */
type ResolvedHeroMarkSpec = HeroMarkSpec

// Canonical HeroMark geometry — the single source both adapters resolve from.
// (Replaces the image-led red rail/tag + ▲ + mixed-case " Hero" fork.)
const HERO_DOT_DOM_PX = 5
const HERO_DOT_PT = 5
const HERO_TAG_TEXT = "HERO"
const HERO_TAG_FONT_DOM_PX = 9
const HERO_TAG_FONT_PT = 5.5
const HERO_TAG_LS_DOM_EM = 0.08
const HERO_TAG_LS_PT = 0.8

/** Resolve a hero flag to its renderer-agnostic HeroMark spec. */
export function deriveHeroMarkSpec(input: HeroMarkInput): HeroMarkSpec {
  return {
    kind: "heroMark",
    isHero: input.isHero,
    dotDomPx: HERO_DOT_DOM_PX,
    dotPt: HERO_DOT_PT,
    tagText: HERO_TAG_TEXT,
    tagFontDomPx: HERO_TAG_FONT_DOM_PX,
    tagFontPt: HERO_TAG_FONT_PT,
    tagLetterSpacingDomEm: HERO_TAG_LS_DOM_EM,
    tagLetterSpacingPt: HERO_TAG_LS_PT,
    familyBoldWhenHero: true,
  }
}

// DOM adapter for HeroMarkSpec. Exhaustive via the explicit return type
// (unhandled variant -> tsc error = red build); promote to a `never` default once
// the union is multi-variant. When !isHero the primitive renders nothing visible
// (self-contained conditional render, NOT visibility:hidden). Ink colour is the
// fixed canonical `var(--sb-ink)`; family-bold is applied by the CONSUMER
// (ProductRow) via `familyBoldWhenHero` — HeroMark owns only the dot + tag.

/** Render a resolved HeroMark spec to DOM primitives. */
export function renderHeroMarkDom(spec: ResolvedHeroMarkSpec): React.ReactElement {
  switch (spec.kind) {
    case "heroMark":
      if (!spec.isHero) {
        return <span data-testid="hero-mark" data-hero="false" />
      }
      return (
        <span
          data-testid="hero-mark"
          data-hero="true"
          style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <span
            data-testid="hero-dot"
            style={{
              width: `${String(spec.dotDomPx)}px`,
              height: `${String(spec.dotDomPx)}px`,
              borderRadius: "50%",
              background: "var(--sb-ink)",
              display: "inline-block",
              alignSelf: "center",
              marginTop: "1px",
            }}
          />
          <span
            data-testid="hero-tag"
            style={{
              fontFamily: "var(--sb-font-ui)",
              fontSize: `${String(spec.tagFontDomPx)}px`,
              fontWeight: 700,
              letterSpacing: `${String(spec.tagLetterSpacingDomEm)}em`,
              textTransform: "uppercase",
              color: "var(--sb-ink)",
            }}
          >
            {spec.tagText}
          </span>
        </span>
      )
  }
}

// @react-pdf adapter for HeroMarkSpec — the only adapter importing @react-pdf, so
// it stays in the lazy pdf chunk. Exhaustive via the explicit return type
// (unhandled variant -> tsc error = red build); promote to a `never` default once
// the union is multi-variant. When !isHero nothing is painted (empty <View />).
// Ink colour is `COLOR.text` (canonical ink; the shipped accent→ink swap per the
// locked decision). The two-space lead on the tag preserves the shipped
// balanced-rows spacing.

/** Render a resolved HeroMark spec to @react-pdf primitives. */
export function renderHeroMarkPdf(spec: ResolvedHeroMarkSpec): React.ReactElement {
  switch (spec.kind) {
    case "heroMark":
      if (!spec.isHero) {
        return <View />
      }
      return (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: spec.dotPt,
              height: spec.dotPt,
              borderRadius: spec.dotPt / 2,
              backgroundColor: COLOR.text,
            }}
          />
          <Text
            style={{
              fontFamily: FONT.uiBold,
              fontSize: spec.tagFontPt,
              letterSpacing: spec.tagLetterSpacingPt,
              textTransform: "uppercase",
              color: COLOR.text,
            }}
          >
            {`  ${spec.tagText}`}
          </Text>
        </View>
      )
  }
}
