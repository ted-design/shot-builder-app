# Shot Builder Design System

## Design Principles

1. **Information Density with Breathing Room**: Power users need to see a lot at once, but with clear visual hierarchy
2. **Scannable over Beautiful**: Every element should serve wayfinding - reduce decorative elements
3. **Progressive Disclosure**: Show essentials first, details on demand
4. **Consistent Spatial Rhythm**: 4px base unit, strict adherence to spacing scale
5. **Action Clarity**: Primary actions always visible, destructive actions require confirmation

## Color Palette

### Brand Colors
- **Primary (Indigo)**: `#6366f1` - Primary actions, active states
- **Primary Dark**: `#4f46e5` - Hover states
- **Success (Emerald)**: `#10b981` - Completed, active status
- **Success Dark**: `#059669` - Hover states

### Semantic Colors
- **Warning**: `#f59e0b` (amber-500) - Discontinued items, caution states
- **Danger**: `#ef4444` (red-500) - Delete, critical errors
- **Info**: `#3b82f6` (blue-500) - Informational messages
- **Neutral Grays**:
  - `#f9fafb` (gray-50) - Page background
  - `#f3f4f6` (gray-100) - Card backgrounds, subtle containers
  - `#e5e7eb` (gray-200) - Borders, dividers
  - `#9ca3af` (gray-400) - Secondary text, placeholders
  - `#6b7280` (gray-500) - Body text secondary
  - `#374151` (gray-700) - Body text primary
  - `#1f2937` (gray-800) - Headings

## Typography

### Font Stack
Primary: Inter (already loaded)
Fallback: System UI stack

### Type Scale
- **Display**: 32px / 40px line-height, -0.02em tracking, semibold (600)
- **H1**: 24px / 32px, -0.01em, semibold (600)
- **H2**: 20px / 28px, -0.01em, semibold (600)
- **H3**: 18px / 28px, normal, semibold (600)
- **Body Large**: 16px / 24px, normal, regular (400)
- **Body**: 14px / 20px, normal, regular (400)
- **Body Small**: 13px / 18px, normal, regular (400)
- **Caption**: 12px / 16px, normal, medium (500)
- **Overline**: 11px / 16px, 0.06em, uppercase, medium (500)

### Usage Rules
- Page titles: Display or H1
- Section headers: H2
- Card titles: H3 or Body Large (semibold)
- Primary content: Body
- Secondary/metadata: Body Small
- Labels/badges: Caption
- Table headers: Overline

## Spacing Scale

Base unit: 4px

- **xs**: 4px (0.25rem)
- **sm**: 8px (0.5rem)
- **md**: 12px (0.75rem)
- **base**: 16px (1rem)
- **lg**: 20px (1.25rem)
- **xl**: 24px (1.5rem)
- **2xl**: 32px (2rem)
- **3xl**: 40px (2.5rem)
- **4xl**: 48px (3rem)
- **5xl**: 64px (4rem)

### Component Spacing Guidelines

**Cards**:
- Padding: base (16px) on mobile, lg (20px) on tablet+
- Gap between cards: base (16px)
- Internal element spacing: sm (8px) between related items

**Forms**:
- Label to input: xs (4px)
- Input to input: base (16px)
- Field groups to field groups: xl (24px)
- Form padding: lg (20px) on mobile, xl (24px) on desktop

**Page Layout**:
- Page padding: base (16px) on mobile, xl (24px) on tablet, 2xl (32px) on desktop
- Section to section: 2xl (32px) minimum
- Header height: 64px (fixed)

**Lists**:
- List item padding: md (12px) vertical, base (16px) horizontal
- List item gap: 1px border or xs (4px) whitespace

## Component Patterns

### Sticky Headers
All list pages use sticky headers with:
- Background: white with subtle shadow on scroll
- Height: 64px minimum
- Content: Page title (left), search (center-left), primary action button (right)
- Z-index: 40

### Cards
- Border: 1px solid gray-200
- Border-radius: 8px (not 14px - too much for small cards)
- Shadow: subtle on hover (`shadow-sm` → `shadow-md`)
- Background: white

### Buttons

**Primary**:
- Background: primary indigo
- Text: white
- Padding: 10px 20px (40px height)
- Border-radius: 6px
- Font: Body (14px), medium (500)

**Secondary**:
- Background: white
- Border: 1px solid gray-300
- Text: gray-700
- Padding: 10px 20px
- Border-radius: 6px

**Tertiary/Ghost**:
- Background: transparent
- Text: gray-600
- Padding: 8px 12px
- Hover: gray-100

**Icon Button**:
- Size: 36px × 36px
- Border-radius: 6px
- Icon: 20px
- Hover: gray-100

### Status Badges
- Height: 20px
- Padding: 0 8px
- Border-radius: 10px (pill)
- Font: Caption (12px), medium (500)
- No border, filled background

**Active/NEW**: Emerald background (`bg-emerald-100`), emerald text (`text-emerald-800`)
**Discontinued**: Amber background, amber text
**Info**: Blue background, blue text

### Input Fields
- Height: 40px
- Border: 1px solid gray-300
- Border-radius: 6px
- Padding: 0 12px
- Font: Body (14px)
- Focus: 2px ring primary, border primary
- Placeholder: gray-400

### Search Fields
- Same as input but with:
- Icon prefix (16px, gray-400)
- Icon padding: 36px left padding
- Clear button on right when active

## Grid Systems

### Product Grid
- Mobile: 1 column
- Tablet (768px+): 2 columns
- Desktop (1024px+): 3 columns
- Large Desktop (1440px+): 4 columns
- Gap: base (16px)

### Shot List / Planner
- Full width cards/lanes on all sizes
- No multi-column on these pages (content too complex)

## Interaction Patterns

### Hover States
- Cards: Lift with shadow-md transition (150ms)
- Buttons: Darken background by 1 shade (150ms)
- List items: Background gray-50

### Loading States
- Skeleton screens (not spinners) for initial loads
- Pulse animation on placeholder content
- Inline spinners for actions (button content replaced)

### Empty States
- Centered icon (48px, gray-300)
- Heading (H3, gray-600)
- Descriptive text (Body, gray-500)
- Primary action button

### Error States
- Toast notifications for non-critical errors
- Inline field errors (red text below input)
- Full-page error for critical failures

## Accessibility

- Minimum touch target: 44×44px
- Color contrast: AA compliance minimum (4.5:1 for body, 3:1 for large text)
- Focus indicators: 2px ring offset 2px
- Semantic HTML throughout
- ARIA labels on icon-only buttons

## Animation

- Page transitions: None (instant is faster)
- Component transitions: 150ms ease-out
- Micro-interactions: 100ms ease-out
- Loading states: 200ms delay before showing (prevents flash)

## Responsive Breakpoints

- Mobile: 0-767px
- Tablet: 768-1023px
- Desktop: 1024-1439px
- Large: 1440px+

### Mobile-Specific Patterns
- Bottom sheet modals instead of centered
- Floating action button for primary actions
- Simplified navigation (hamburger menu)
- Touch-optimized spacing (larger tap targets)
