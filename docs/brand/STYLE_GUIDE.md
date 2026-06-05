# IMMEDIATE — Brand Spec (target spec for the app)

> Structured extraction of `Immediate-Style-Guide-2026.pdf` (in this folder), for use by claude.ai/design and the design system. This is the brand TARGET; reconcile the app's current tokens toward it deliberately (see `docs/DESIGN_SYSTEM.md` for the current system).

Source: `Immediate-Style-Guide-2026.pdf` (28 pp.; internal brand asset). Read-only audit; no app/source files were touched. OKLCH values are computed conversions from the published sRGB hex (rounded; L as 0–1, C to 3 decimals, H in degrees).

## 1. Color Palette

### Primary (note: deliberately NOT pure white/black)
| Name | Hex | RGB | OKLCH |
|---|---|---|---|
| Immediate White | `#F5F5F5` | 245,245,245 | `oklch(0.967 0.000 0)` |
| Immediate Black | `#0E0E0E` | 14,14,14 | `oklch(0.151 0.000 0)` |

### Secondary (signature)
| Name | Hex | RGB | OKLCH |
|---|---|---|---|
| Immediate Red | `#EB1400` | 235,20,0 | `oklch(0.602 0.243 30.6)` |

Usage: red is the brand signature but used sparingly — logo, statements, highlights only. Avoid busy/overwhelming use.

### Neutrals (greys, defined as % black)
| Name | Spec | Hex | RGB | OKLCH |
|---|---|---|---|---|
| Light Grey | 10% black | `#E6E6E6` | 230,230,230 | `oklch(0.922 0.000 0)` |
| Mid Grey | 40% black | `#9F9F9F` | 159,159,159 | `oklch(0.694 0.000 0)` |
| Dark Grey | 70% black | `#565656` | 86,86,86 | `oklch(0.470 0.000 0)` |
| Charcoal | 90% black + 1% red | `#282626` | 40,38,38 | `oklch(0.270 0.002 25)` |

### Accents (division-specific)
| Name | Division | Hex | RGB | OKLCH |
|---|---|---|---|---|
| Beige | shared | `#F1EBE2` | 241,235,226 | `oklch(0.940 0.010 80)` |
| Baby Blue | Immediate Brands | `#D7F0FF` | 215,240,255 | `oklch(0.940 0.030 230)` |
| Pink | Immediate Brands | `#F59FB8` | 245,159,184 | `oklch(0.785 0.110 5)` |
| Blue | Immediate Studio | `#009BDD` | 0,155,221 | `oklch(0.640 0.140 235)` |

Accent role: add depth and distinguish brand divisions. (Page 22 brackets Baby Blue + Pink under Immediate Brands and Blue under Immediate Studio; Beige is shared.)

## 2. Typography

Three typefaces, designed to be combined; Founders Grotesk and Ivy Presto may be used interchangeably depending on context.

| Role | Typeface | Weight/Style | Line height | Letter spacing |
|---|---|---|---|---|
| Heading / Big Statement | Founders Grotesk X-Condensed | Bold | 78% | 0 |
| Subheading / Quote / Stats | Ivy Presto Headline | Light or Semibold (italic used for emphasis) | 110% | 0 |
| Body | Neue Haas Grotesk Display | Regular/roman | 130–150% | 0 |
| Caption | Neue Haas Grotesk | All caps | 150% | 10–15% (i.e. 100–150 tracking units) |

Notes:
- Founders Grotesk X-Condensed Bold = impact/momentum, headlines and large statements. Tight 78% line height stacks lines densely.
- Ivy Presto Headline = serif, editorial sophistication; supporting headings, pull-quotes, stats. (This is the serif seen on section sub-headers and intro copy.)
- Neue Haas Grotesk Display = the bridge between bold and calm; default body/paragraph face; "Display" cut is the default for flexibility.

### Iconic Period (typographic rule)
Headlines and statements end with the signature period, echoing the logo:
- Heading font: Founders Grotesk X-Condensed Bold.
- Period font: Ivy Presto Headline Bold.
- Period size = heading size ÷ 1.2, rounded up (e.g. heading 154 → period 128; examples on p24: H172/P144, H140/P117, H96/P80).
- Period color: default Red; but prioritize readability — if red isn't legible, match the heading color.

## 3. Logo Usage & Clear-Space

- Primary logo: the "IMMEDIATE." wordmark — Founders Grotesk X-Condensed Bold, with the red period. Prioritize wherever possible. Bold, confident, highly legible. The red period = action, completion, momentum.
- Color variations (use the highest-contrast version for the environment; retain the red period whenever possible):
  - Colour · Dark — black wordmark + red period on light bg.
  - Colour · Light — white wordmark + red period on dark bg.
  - Black — solid black wordmark (period black) for mono/light bg.
  - White — solid white wordmark for red or dark bg.
- Logo clear space: minimum clear space equal to the height of the logo (equivalently the height of the letter "I") on all sides.
- Symbol: the geometric "ib"-style mark (two circles + two squares in a 2×2-ish grid) representing the interconnected ecosystem / collaboration. Flexible shorthand; may replace full logo where space/scale demands.
  - Symbol variations: Primary (black), Inverted (white outline/fill on dark or red).
  - Symbol clear space: minimum clear space equal to the size of the circle element.

### Sub-branding
- Two divisions: Immediate Brands and Immediate Studio, expressed as sub-logos (wordmark + division name stacked).
- Sub-logos provide context/introduction to a division; once context is established, revert to the Primary Logo.
- Lockup is flexible — division name need not be in the default stacked lockup, but the Immediate wordmark AND the division name must both remain visible within the same composition, with their relationship clear even when separated across a layout.

### Logo Rules (8 don'ts)
1. Do not rotate, stretch, or skew.
2. Do not alter the design or proportion.
3. Do not use unapproved colour.
4. Do not create unapproved lockups.
5. Do not add unapproved text.
6. Do not add visual effects (shadows, glows, etc.).
7. Do not obstruct, or place on a distracting background.
8. Brand marks must be clear, legible, and accessible.
(These apply to all brand marks unless approved by the designer + brand team.)

## 4. Spacing / Grid System

The guide does not publish an explicit numeric spacing scale (no 4/8px token table). The systematic spacing rules that ARE defined:
- Logo clear space = 1× logo height (or "I" height).
- Symbol clear space = 1× circle diameter.
- Iconic-period sizing = heading ÷ 1.2, round up.
- Layout language (observed across the deck): generous whitespace, strong two/three-column splits, a top utility nav row (ABOUT / LOGO & SYMBOL / VISUAL ELEMENTS) with a hairline rule, hairline dividers between list items, and a running footer ("IMMEDIATE • BRAND STYLE GUIDE" left, "n • 28" right). Column gutters and a 12-col-feel grid are implied but not numerically specified.

If the app needs a spacing token scale, it must be derived/proposed — it is not in this source.

## 5. Iconography + Imagery / Photography

### Graphics system (derived from the symbol)
Two modular graphic devices, both built from the symbol's circle + square forms. Optional; use sparingly to avoid busy design.
- Outline graphic: a single rounded container shape derived from the symbol silhouette. Scalable in width or height, but corner proportions are FIXED. Do not stretch the corners; do not skew or rotate. Used as containers, framing devices for images, and colored (black/red) quote blocks.
- Duo Division graphic: the circle + square set, usable whole or separated. Separated forms map to divisions (the "i" stack of square+circle ↔ Immediate Brands; square+circle ↔ Immediate Studio). Proportion must be maintained — do not stretch, skew, or rotate. Also used as repeating geometric patterns (circles/half-circles/squares grid) and icon animation.

### Iconography
No bespoke UI icon set is specified. Social icons on the closing page use simple filled circular glyphs (Instagram, LinkedIn, Vimeo). The brand's "icon" language is the symbol + Duo Division shapes, not a line-icon library.

### Photography treatment
- General project/client imagery: keep true to original, largely unaltered, aside from subtle black or white overlays to improve contrast/readability.
- Internal team / behind-the-scenes imagery: apply the signature treatment — Photo + Greyscale + Charcoal color layer, Blend mode: Difference, Opacity: 100%. The charcoal overlay adds depth and consistency.
- Rationale: grayscale team imagery keeps client work as the focal point. Subject matter skews documentary/on-set production (crew, cameras, studio), plus bold color editorial/portrait work for client examples.

## 6. Brand Voice & Tone

Core: "Immediate is confident, capable, and collaborative."

Voice is:
- Refined yet approachable
- Creatively expressive yet intentional
- Energizing and grounding
- Confident without taking ourselves too seriously

We are NOT: loud, pretentious, chaotic, transactional, or passive. Values: precision over hype, results over abstractions, collaboration over ego. Above all, care about the craft, the people behind it, and the people it's created for. Every expression should feel connected to the same core personality.

### Division voice expressions
- Immediate Brands: Sophisticated, Entrepreneurial, Editorial, Growth-Oriented, Operationally Minded. Speaks like a trusted extension of the brand team — calm, capable, dependable; structure + clarity with a balance of creative thinking and operational discipline. Tagline: "Content that moves you, with you, for you." (You = content that creates real impact; With You = scales with ambition; For You = moves brands forward.)
- Immediate Studio: Bold, Personable, Empathetic, Playful Yet Disciplined, Expressive. Speaks like a creative production leader — confident, collaborative, energized by ambitious ideas while grounded in process and execution. Tagline: "Fast moves. Fearless production. First-class execution. Genuinely fun." (Fast Moves = clarity + precision; Fearless Production = ambitious ideas made possible; First-Class Execution = uncompromising standards; Genuinely Fun = collaborative + rewarding regardless of scope.)

### Brand architecture / naming (for copy)
- Immediate Group = parent/corporate entity (legal, admin, contracts, registrations, website footer).
- Immediate = brand + production philosophy connecting all divisions; lead with "Immediate" in the majority of external comms (brand messaging, website headlines, marketing, case studies).
- Immediate Brands = DTC branded-content production; Immediate Studio = agency/commercial production. Use division names to set context, then return to "Immediate."
- Style-guide tone itself: "Use these guidelines as a framework, not a limitation. Consistency creates strength, but creativity is what brings the brand to life."

## 7. Explicit Do's and Don'ts

Do:
- Lead with "Immediate" in external comms; use division names only to set context.
- Use the highest-contrast logo variation for the environment; retain the red period whenever possible.
- Maintain logo clear space = logo height; symbol clear space = circle size.
- Use red sparingly (logo, statements, highlights).
- End headlines/statements with the iconic period using the size formula (heading ÷ 1.2, round up), red by default but match heading color if red isn't legible.
- Keep both wordmark + division name visible together in any division lockup.
- Keep graphic devices' corner/shape proportions fixed; use them sparingly.
- Keep client imagery largely unaltered (subtle B/W overlays only); reserve the charcoal/Difference grayscale treatment for internal/BTS imagery.
- Treat the system as a framework that still allows creativity.

Don't (logo/marks): rotate, stretch, skew; alter design or proportion; use unapproved colour; create unapproved lockups; add unapproved text; add visual effects; obstruct or place on distracting backgrounds; ever let marks become illegible/inaccessible.

Don't (graphics): stretch the Outline corners; stretch/skew/rotate the Duo Division shapes; overuse decorative graphics (avoid busy/overwhelming layouts).

Don't (color): use pure `#FFFFFF`/`#000000` for the "white/black" brand colors — use Immediate White `#F5F5F5` and Immediate Black `#0E0E0E`; don't overuse red.

Don't (voice): be loud, pretentious, chaotic, transactional, or passive; don't prioritize hype/abstraction/ego.

## Notable gaps (not specified in the source — must be proposed, not "extracted")
- No numeric spacing scale, no defined type-size ramp (px/rem) beyond the iconic-period example sizes, no border-radius tokens, no elevation/shadow tokens (and shadows are explicitly disallowed on logos), no component specs, no light/dark UI semantic token mapping. The closest to motion guidance is "icon animation" referenced under the Duo Division graphic.

Contact references in the deck (for provenance, not brand tokens): brand designer hello@lilyle.com; Ryan Bergmann (Founding Partner / Creative Director) r.bergmann@immediategroup.ca; Ted Ghanime (Partner / Head of Production) ted@immediategroup.ca.