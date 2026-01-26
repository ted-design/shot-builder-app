# R.7 — Profiles Canvas Workspace Stage + Inner Tabs

**Date**: 2026-01-26
**Scope**: Profiles Canvas with workspace stage, summary band, inner tabs, and designed empty states (Products V3 parity)

This session document covers R.6 (design polish) and R.7 (workspace stage + tabs).

---

## Prior Work: R.6 — Design Polish

R.6 was a focused design polish pass on the Profile Canvas (Talent + Crew views) to transform it from "UI components arranged correctly" into a "designed product surface" with editorial rhythm, clear semantic zones, and intentional visual hierarchy.

## Design Goals (from spec)

1. **Semantic Zones** - Four distinct blocks: Hero/Identity, Primary Facts, Domain Block, Notes
2. **Editorial Rhythm** - Generous whitespace, calm visual language
3. **Typography Hierarchy** - Hero (2xl), section labels (xs uppercase), body values (sm)
4. **Inline Edit Polish** - Better focus states, calmer affordances
5. **Products V3 Parity** - Match the stable frame + evolving content pattern

## Files Changed

### `src/components/profiles/ProfileCanvas.jsx`
- **Lines 1-45**: Updated header comments for R.6
- **Lines 46-120**: Added `SectionHeader` and `FactRow` helper components
- **Lines 170-210**: Refactored main component with editing section tracking
- **Lines 220-450**: Complete rewrite of render section with four semantic zones:
  - **Zone 1: Hero/Identity** - Type badge above image, centered layout, name as hero anchor
  - **Zone 2: Primary Facts** - Clean 2-column grid (Gender, Portfolio, Email, Phone)
  - **Zone 3: Domain Block** - Measurements spec grid (Talent) or Role chips (Crew)
  - **Zone 4: Notes Block** - Narrative surface with helpful empty states

### `src/components/profiles/InlineEditField.jsx`
- **Lines 1-20**: Updated comments for R.6
- **Lines 140-175**: Removed mechanical "(click to edit)" text, cleaner hover states
- **Lines 180-245**: Calmer edit mode styling with subtle focus rings

## Design Changes

### Before (R.5)
- Type badge positioned awkwardly below image
- Icon + label + value rows (form-like appearance)
- Single card containing all fields
- Generic "Click to edit" text on hover
- No clear separation between contact info and domain data

### After (R.6)
- Type badge small and calm, positioned above image
- Hero image with proper aspect ratio (3:4 for talent, circular for crew)
- Name as clear typographic anchor
- **CONTACT** section with 2-column grid (no icons, just label/value)
- **MEASUREMENTS** or **ROLE** section with proper spec grid
- **NOTES** section with designed empty states
- Inline edit hover is subtle (title attribute only)
- Section headers use uppercase tracking-wider labels (Products V3 pattern)

## Screenshots

Before/After comparisons saved to `.playwright-mcp/`:

| View | Before | After |
|------|--------|-------|
| All Profiles | `before-profiles-all.png` | `after-profiles-all.png` |
| Talent Only | `before-profiles-talent.png` | `after-profiles-talent.png` |
| Crew Only | `before-profiles-crew.png` | `after-profiles-crew.png` |
| Scrolled | - | `after-profiles-all-scrolled.png` |

## Visual Improvements

1. **Talent Canvas**
   - Larger editorial portrait (w-40 h-52, rounded-2xl)
   - Type badge above image in calm violet
   - 2-column Contact grid: Gender/Portfolio, Email/Phone
   - Measurements as clean spec grid with uppercase labels
   - Notes section with helpful prompt text

2. **Crew Canvas**
   - Smaller circular avatar (w-20 h-20)
   - Type badge above in calm sky blue
   - Company shown as secondary identity line
   - 2-column Contact grid: Email/Phone
   - Role section with position/department chips
   - Notes section with helpful prompt text

## Technical Notes

- No schema changes
- No new Firestore writes
- No route changes
- Existing RBAC patterns preserved
- Measurements remain string-based (TODO: future numeric normalization)

## Manual QA Checklist

- [x] Lint passes (`npm run lint`)
- [x] Build succeeds (`npm run build`)
- [x] Talent profile displays correctly with all zones
- [x] Crew profile displays correctly with all zones
- [x] Inline editing works for name, agency/company, contact fields
- [x] Empty states display helpful prompts
- [x] Type badge position is calm and intentional
- [x] Section headers follow Products V3 pattern
- [x] Measurements grid aligns properly
- [x] Notes section is prominent and usable

## Kobolabs Reference

Used kobolabs.io as visual sensibility reference only (marketing pages):
- Calm editorial rhythm
- Generous whitespace
- Soft hierarchy
- Minimal chrome
- Subtle borders
- Confident typography
- Restraint

## Next Steps (Future Deltas)

- **Future**: Measurements normalization to numeric fields for filtering/range search
- **Future**: Image upload for crew avatars
- **Future**: Wire "Used in" metric to actual project usage data

---

# R.7: Profiles Canvas Workspace Stage + Tabs

**Date**: 2026-01-26
**Scope**: Refactor Profiles Canvas to Products V3 parity with workspace stage, summary band, inner tabs, and designed empty states

## Summary

R.7 transforms the Profiles Canvas from a "details column" into a "workspace within the workspace" matching Products V3 quality. The canvas now features a stable white workspace stage container, a compact 3-metric summary band, type-aware inner tabs, and purposeful next-action empty states.

## Design Goals

1. **Workspace Stage** - White card container with subtle border/shadow wrapping all content
2. **Summary Metrics Band** - 3 slots: Completeness, Last Updated, Usage
3. **Inner Tabs** - Type-aware tab sets (Talent vs Crew have different tabs)
4. **Designed Empty States** - Next-action guidance instead of "Not provided"
5. **Products V3 Parity** - Match the Colorway Workspace design pattern

## Files Changed

### `src/components/profiles/ProfileCanvas.jsx`
- **Lines 1-37**: Complete header rewrite for R.7 with new imports
- **Lines 93-177**: Added completeness heuristic and timestamp formatting utilities
- **Lines 179-232**: New `SummaryBand` component with `MetricSlot` helper
- **Lines 234-272**: New `TabEmptyState` component for designed empty states
- **Lines 274-321**: Simplified `FactRow` component (removed "Not provided" → uses "—")
- **Lines 323-523**: New tab content components:
  - `OverviewTab` - Contact info in 2-column grid
  - `MeasurementsTab` - Talent only, with empty state
  - `GalleryTab` - Talent only, placeholder empty state
  - `RoleTab` - Crew only, with role chips or empty state
  - `NotesTab` - Both types, with inline edit or empty state
- **Lines 525-848**: Main `ProfileCanvas` component rewrite:
  - Workspace stage container (`rounded-2xl shadow-sm border`)
  - Hero/Identity block inside stage
  - Summary band placement
  - Type-aware Tabs component integration

## Tab Structure

### Talent Profile Tabs
| Tab | Content |
|-----|---------|
| Overview | Gender, Portfolio, Email, Phone |
| Measurements | Spec grid or "No measurements yet" empty state |
| Gallery | "No gallery images" empty state (placeholder) |
| Notes | Inline edit field or empty state |

### Crew Profile Tabs
| Tab | Content |
|-----|---------|
| Overview | Company, Email, Phone |
| Role | Position/Dept chips or "No role assigned" empty state |
| Notes | Inline edit field or empty state |

## Summary Band Metrics

| Slot | Icon | Label | Value |
|------|------|-------|-------|
| 1 | CheckCircle2 | Completeness | `X/Y` (computed from filled fields) |
| 2 | Clock | Last updated | Human-friendly date (Today, Yesterday, Xd ago, Xw ago) |
| 3 | Link2 | Used in | `—` (stub for future wiring) |

### Completeness Heuristic

**Talent (9 fields)**:
- Name, Gender, Agency, Portfolio URL, Email, Phone, Notes, Headshot, Measurements (any)

**Crew (7 fields)**:
- Name, Company, Email, Phone, Department, Position, Notes

## Empty State Design

Each empty state follows a consistent pattern:
- Icon in rounded container (10×10, rounded-xl)
- Title (sm font, medium weight)
- Description (xs, muted, helpful next-action guidance)
- Action button (no-op, indicates what user should do next)

### Example Empty States

| Tab | Title | Description | Action |
|-----|-------|-------------|--------|
| Measurements | No measurements yet | Add baseline measurements to enable filtering and casting queries. | Add measurements → |
| Gallery | No gallery images | Upload 3–5 selects for quick casting review. | Upload images → |
| Role | No role assigned | Assign department + position to power call sheets and crew planning. | Assign role → |
| Notes | No notes yet | Add on-set notes like availability, restrictions, wardrobe, or preferences. | (focuses field if editable) |

## Screenshots

Playwright MCP screenshots saved to `.playwright-mcp/`:

| File | Description |
|------|-------------|
| `profiles-talent-overview.png` | Talent workspace with Overview tab |
| `profiles-talent-measurements-empty.png` | Measurements tab empty state |
| `profiles-talent-gallery-empty.png` | Gallery tab empty state |
| `profiles-final-talent.png` | Final talent view at 1440px width |
| `profiles-crew-final.png` | Crew profile selected |

## Before/After Behavior

| Aspect | Before (R.6) | After (R.7) |
|--------|--------------|-------------|
| Container | Four semantic zones, flat | Single workspace stage card |
| Metrics | None | Summary band with 3 slots |
| Tabs | None | Type-aware inner tabs |
| Empty states | "Not provided" / "No X on file" | Designed next-action empty states |
| Layout | Zones stacked vertically | Hero + Band → Tabs → Content |
| Measurements | Zone with grid or italic text | Tab with grid or empty state |
| Notes | Zone with edit field | Tab with edit field or empty state |

## Technical Notes

- **NO schema changes** - Completeness computed client-side from existing fields
- **NO new Firestore writes** - Read-only metrics
- **NO route changes** - Same URL structure
- Uses existing `@radix-ui/react-tabs` via `src/components/ui/tabs.jsx`
- Tab state is local (not URL-persisted)
- Default tab is "Overview"

## Manual QA Checklist

- [x] `npm run lint` passes (0 warnings)
- [x] `npm run build` succeeds
- [x] Talent profile shows: Overview, Measurements, Gallery, Notes tabs
- [x] Crew profile shows: Overview, Role, Notes tabs (no Measurements/Gallery)
- [x] Summary band shows Completeness, Last Updated, Used In
- [x] Completeness computes correctly (7/9 for filled talent, 4/7 for partial crew)
- [x] Last Updated shows human-friendly format
- [x] Empty states render with icon, title, description
- [x] Inline editing still works in Overview and Notes tabs
- [x] Workspace stage has white bg, rounded-2xl, subtle shadow
- [x] Type badge and hero image display correctly in stage

## Design References Used

- Products V3 `ColorwaysWorkspace.jsx` - Cockpit pattern with tabs
- Products V3 `BentoCard.jsx` - Card styling
- Products V3 `WorkspaceEmptyState.jsx` - Empty state pattern
- KoboLabs sensibility (calm, editorial, restrained)
