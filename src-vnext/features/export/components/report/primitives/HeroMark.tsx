import {
  deriveHeroMarkSpec,
  renderHeroMarkDom,
} from "../../../lib/report/primitives/heroMark"
import type { HeroMarkInput } from "../../../lib/report/primitives/heroMark"

// DOM wrapper for the canonical HeroMark primitive. Thin: derives the spec from
// the hero flag and hands it to the shared DOM adapter, so the preview and the
// @react-pdf export present ONE spec and can't drift. Does NOT import @react-pdf
// (the PDF adapter is a separate named export in the co-located lib file), so
// this stays in the DOM-only tree.

/** Preview HeroMark — ink round dot + uppercase INK "HERO" tag when hero;
 * renders nothing visible otherwise. */
export function HeroMarkView(props: HeroMarkInput): React.ReactElement {
  return renderHeroMarkDom(deriveHeroMarkSpec({ isHero: props.isHero }))
}
