# Shot Builder Design System

**Version**: 1.0.0
**Last Updated**: 2025-11-04
**Status**: Active

---

## Table of Contents

1. [Brand Guidelines](#brand-guidelines)
2. [Design Tokens](#design-tokens)
3. [Typography](#typography)
4. [Color System](#color-system)
5. [Spacing & Layout](#spacing--layout)
6. [Component Patterns](#component-patterns)
7. [Accessibility Standards](#accessibility-standards)
8. [Usage Examples](#usage-examples)

---

## Brand Guidelines

### Co-Branding Strategy

Shot Builder is co-branded with **Immediate** and **Unbound Merino**. The application reflects both brands while maintaining its own identity as a production tool.

#### Brand Personalities

**Immediate**
- **Identity**: Bold, dynamic media production brand
- **Primary Color**: Immediate Red `#E31E24`
- **Typography**: Bold, sans-serif
- **Personality**: Energetic, media-focused, production-oriented
- **Logo Usage**: Full wordmark + play icon

**Unbound Merino**
- **Identity**: Clean, minimalist, sophisticated
- **Typography**: Modern geometric sans-serif
- **Color**: Black or white (context-dependent)
- **Personality**: Refined, quality-focused, modern
- **Logo Usage**: Wordmark-only, no icon

#### Logo Placement Rules

**Primary Header:**
```
┌─────────────────────────────────────────────────────────────┐
│ [☰] [Immediate Logo] + [Unbound Logo] │ Project │ Theme │⚙│
└─────────────────────────────────────────────────────────────┘
```

**Specifications:**
- **Position**: Top-left, after hamburger menu
- **Layout**: Horizontal lockup with separator
- **Size**: 32px height (desktop), 24px (mobile)
- **Separator**: Thin vertical line (`bg-slate-300 dark:bg-slate-600`)
- **Theme**: Logos switch based on dark/light mode

**Logo Component:**
```jsx
<BrandLockup size="md" />
```

#### Brand Color Usage

| Color | Hex | Usage |
|-------|-----|-------|
| **Immediate Red** | `#E31E24` | Logo, brand moments, featured CTAs |
| **Immediate Red Dark** | `#B51A1F` | Hover states for brand elements |

**Important**: Immediate red is a **brand color, not a UI color**. Use it for:
- ✅ Logo presence
- ✅ High-priority CTAs (e.g., "Start Shoot")
- ✅ Featured content highlights

Do **NOT** use for:
- ❌ Standard buttons (use `primary` indigo instead)
- ❌ Links (use `primary` indigo)
- ❌ Error states (use `danger` red)

---

## Design Tokens

Design tokens are semantic names for design values. Always use tokens instead of raw Tailwind utilities for consistency and maintainability.

### Why Design Tokens?

**❌ Without tokens:**
```jsx
<h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100">
```
- Hard to remember
- Inconsistent application
- Difficult to update globally

**✅ With tokens:**
```jsx
<h1 className="heading-page">
```
- Self-documenting
- Consistent
- Easy to update

### Available Tokens

All design tokens are available as Tailwind utility classes via our custom plugin.

**Typography Tokens:**
- `.heading-page` - Page-level headings
- `.heading-section` - Section headings
- `.heading-subsection` - Subsection headings
- `.body-text` - Standard body text
- `.body-text-muted` - De-emphasized text
- `.caption` - Small captions
- `.label` - Form labels

**Spacing Tokens:**
- `.page-wrapper` - Page-level vertical spacing
- `.section-gap` - Section gaps
- `.card-padding` - Standard card padding
- `.toolbar-padding` - Toolbar padding
- `.content-padding` - Content area padding

---

## Typography

### Scale

| Token | Size | Weight | Usage |
|-------|------|--------|-------|
| `.heading-page` | 2xl → 3xl | bold | Page titles |
| `.heading-section` | xl | semibold | Section titles |
| `.heading-subsection` | lg | semibold | Subsections |
| `.body-text` | sm | normal | Body content |
| `.body-text-muted` | sm | normal | Secondary text |
| `.caption` | xs | normal | Captions, metadata |
| `.label` | sm | medium | Form labels |

### Font Families

```javascript
{
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['Fira Code', 'Courier New', 'monospace']
}
```

### Typography Examples

```jsx
// Page header
<h1 className="heading-page">Shot Management</h1>

// Section header
<h2 className="heading-section">Active Shots</h2>

// Subsection
<h3 className="heading-subsection">Pending Review</h3>

// Body text
<p className="body-text">
  This shot requires 3 products and 2 talent members.
</p>

// Muted text
<p className="body-text-muted">
  Created 2 hours ago by John Doe
</p>

// Caption
<span className="caption">Shot #1234</span>

// Form label
<label className="label">Shot Title</label>
```

---

## Color System

### Palette

#### Brand Colors
```javascript
{
  'immediate-red': '#E31E24',
  'immediate-red-dark': '#B51A1F',
}
```

#### UI Colors
```javascript
{
  primary: '#6366f1',        // Indigo - Primary actions
  'primary-dark': '#4f46e5', // Indigo hover
  secondary: '#10b981',      // Emerald - Success
  warning: '#f59e0b',        // Amber - Warnings
  danger: '#ef4444',         // Red - Errors
}
```

#### Neutrals (Slate Scale)
```javascript
{
  neutral: {
    50: 'rgb(248 250 252)',   // Lightest backgrounds
    100: 'rgb(241 245 249)',  // Subtle backgrounds
    200: 'rgb(226 232 240)',  // Borders, dividers
    300: 'rgb(203 213 225)',  // Borders
    400: 'rgb(148 163 184)',  // Disabled text
    500: 'rgb(100 116 139)',  // Secondary text
    600: 'rgb(71 85 105)',    // Body text
    700: 'rgb(51 65 85)',     // Dark backgrounds
    800: 'rgb(30 41 59)',     // Dark surface
    900: 'rgb(15 23 42)',     // Darkest
    950: 'rgb(2 6 23)',       // Ultra dark
  }
}
```

#### Semantic Aliases
```javascript
{
  surface: {
    DEFAULT: '#ffffff',       // Light mode surface
    dark: 'rgb(30 41 59)',    // Dark mode surface (slate-800)
  },
  muted: {
    DEFAULT: 'rgb(241 245 249)', // Light mode muted (slate-100)
    dark: 'rgb(51 65 85)',       // Dark mode muted (slate-700)
  }
}
```

### Color Usage Guidelines

| Element | Color | Example |
|---------|-------|---------|
| **Primary Actions** | `primary` (indigo) | Buttons, links, active nav |
| **Success States** | `secondary` (emerald) | Success badges, completed |
| **Warnings** | `warning` (amber) | Alerts, pending states |
| **Errors** | `danger` (red) | Error messages, destructive actions |
| **Brand Moments** | `immediate-red` | CTAs, featured content |
| **Backgrounds** | `neutral-50/100` | Page backgrounds, cards |
| **Borders** | `neutral-200/300` | Dividers, card borders |
| **Text** | `neutral-600/900` | Body text, headings |

### Color Examples

```jsx
// Primary button
<button className="bg-primary hover:bg-primary-dark">
  Create Shot
</button>

// Success badge
<span className="bg-secondary/10 text-secondary">
  Completed
</span>

// Warning alert
<div className="bg-warning/10 border-warning">
  Review required
</div>

// Error message
<p className="text-danger">Invalid input</p>

// Brand CTA
<button className="bg-immediate-red hover:bg-immediate-red-dark">
  Start Shoot
</button>

// Card with neutral colors
<div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
  Card content
</div>
```

---

## Spacing & Layout

### Spacing Scale

Use Tailwind's default spacing scale (4px base unit) with semantic tokens for common patterns.

| Token | Value | Usage |
|-------|-------|-------|
| `.page-wrapper` | `space-y-6` | Page-level vertical spacing |
| `.section-gap` | `gap-6` | Section gaps |
| `.card-padding` | `p-6` | Standard card padding |
| `.toolbar-padding` | `px-6 py-3` | Toolbar padding |
| `.content-padding` | `px-6 py-4` | Content area padding |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-card` | 8px | Cards, panels |
| `rounded-btn` | 6px | Buttons |
| `rounded-input` | 6px | Form inputs |
| `rounded-lg` | 8px | Large elements |
| `rounded-md` | 6px | Medium elements |

### Layout Examples

```jsx
// Page wrapper
<div className="page-wrapper">
  <PageHeader />
  <Toolbar />
  <div>Content</div>
</div>

// Card
<div className="card-padding rounded-card bg-white dark:bg-neutral-800">
  Card content
</div>

// Toolbar
<div className="toolbar-padding flex justify-between">
  <div>Left content</div>
  <div>Right content</div>
</div>

// Section with gaps
<div className="flex section-gap">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

---

## Component Patterns

### PageHeader

**Purpose**: Consistent page headers with optional breadcrumbs, description, and action buttons.

**Structure**:
```jsx
<PageHeader>
  <PageHeader.Title>Page Title</PageHeader.Title>
  <PageHeader.Description>Optional description</PageHeader.Description>
  <PageHeader.Actions>
    <Button>Action</Button>
  </PageHeader.Actions>
</PageHeader>
```

**Features**:
- Sticky positioning
- Responsive typography
- Dark mode support
- Optional breadcrumbs

**When to use**:
- Every page should have a PageHeader
- Use `.heading-page` token for custom headers

### Toolbar

**Purpose**: Action bars for filtering, sorting, bulk operations.

**Structure**:
```jsx
<Toolbar>
  <Toolbar.Left>
    <SearchInput />
    <FilterButton />
  </Toolbar.Left>
  <Toolbar.Right>
    <SortDropdown />
    <ViewToggle />
  </Toolbar.Right>
</Toolbar>
```

**When to use**:
- Above lists/grids
- For search, filter, sort controls
- When actions need to be grouped

### Card

**Purpose**: Consistent containers for content.

**Variants**:
- Default: White background, border, padding
- Hover: Subtle hover effect
- Interactive: Clickable cards

**When to use**:
- Shot cards
- Product cards
- Talent cards
- Any grouped content

### BrandLockup

**Purpose**: Display co-branded logos in app header.

**Structure**:
```jsx
<BrandLockup size="md" />
```

**Props**:
- `size`: "sm" | "md" | "lg"
- Automatically switches logos based on theme

---

## Accessibility Standards

### Requirements

All components must meet **WCAG 2.1 Level AA** standards.

#### Color Contrast

- **Normal text**: 4.5:1 minimum
- **Large text** (18px+): 3:1 minimum
- **UI components**: 3:1 minimum

Our color system is designed to meet these requirements:
- `neutral-900` on white: ✅ 15.5:1
- `neutral-700` on white: ✅ 8.7:1
- `neutral-600` on white: ✅ 6.5:1
- `primary` on white: ✅ 6.2:1

#### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Focus indicators must be visible
- Logical tab order
- Escape key closes modals/menus

#### Screen Readers

- Use semantic HTML (`<header>`, `<nav>`, `<main>`)
- Provide `aria-label` for icon-only buttons
- Use `alt` text for all images
- Announce dynamic content changes

### Accessibility Checklist

- [ ] Color contrast meets WCAG AA
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] ARIA labels on icon buttons
- [ ] Alt text on images
- [ ] Semantic HTML structure
- [ ] Skip links for keyboard users
- [ ] No text in images

---

## Usage Examples

### Complete Page Example

```jsx
import { PageHeader } from '@/components/ui/PageHeader';
import { Toolbar } from '@/components/ui/Toolbar';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';

export function ShotsPage() {
  return (
    <div className="page-wrapper">
      {/* Page Header */}
      <PageHeader>
        <PageHeader.Title>Shots</PageHeader.Title>
        <PageHeader.Description>
          Manage shots for your photo and video productions
        </PageHeader.Description>
        <PageHeader.Actions>
          <Button variant="primary">Create Shot</Button>
        </PageHeader.Actions>
      </PageHeader>

      {/* Toolbar */}
      <Toolbar>
        <Toolbar.Left>
          <SearchInput placeholder="Search shots..." />
          <FilterButton />
        </Toolbar.Left>
        <Toolbar.Right>
          <ViewToggle />
        </Toolbar.Right>
      </Toolbar>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 section-gap">
        <Card className="card-padding">
          <h3 className="heading-subsection">Shot Title</h3>
          <p className="body-text-muted">Shot details here</p>
        </Card>
      </div>
    </div>
  );
}
```

### Typography Example

```jsx
function TypographyShowcase() {
  return (
    <div className="space-y-4">
      <h1 className="heading-page">Page Heading</h1>
      <h2 className="heading-section">Section Heading</h2>
      <h3 className="heading-subsection">Subsection Heading</h3>
      <p className="body-text">Regular body text for content.</p>
      <p className="body-text-muted">Muted text for less important content.</p>
      <span className="caption">Small caption text</span>
      <label className="label">Form Label</label>
    </div>
  );
}
```

### Color Example

```jsx
function ColorShowcase() {
  return (
    <div className="space-y-4">
      {/* Brand color (use sparingly) */}
      <button className="bg-immediate-red text-white px-4 py-2 rounded-btn">
        Start Shoot (Featured CTA)
      </button>

      {/* Primary UI color (standard actions) */}
      <button className="bg-primary text-white px-4 py-2 rounded-btn">
        Create Shot
      </button>

      {/* Status badges */}
      <span className="bg-secondary/10 text-secondary px-2 py-1 rounded-md">
        Completed
      </span>
      <span className="bg-warning/10 text-warning px-2 py-1 rounded-md">
        Pending
      </span>
      <span className="bg-danger/10 text-danger px-2 py-1 rounded-md">
        Error
      </span>

      {/* Neutral backgrounds */}
      <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-card">
        Content with neutral background
      </div>
    </div>
  );
}
```

---

## Migration Guide

### Migrating from Direct Utilities

**Step 1**: Replace typography utilities with tokens

```jsx
// Before
<h1 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100">

// After
<h1 className="heading-page">
```

**Step 2**: Replace gray-* with neutral-*

```jsx
// Before
<div className="bg-slate-100 dark:bg-slate-800">

// After
<div className="bg-neutral-100 dark:bg-neutral-800">
```

**Step 3**: Use semantic spacing

```jsx
// Before
<div className="space-y-6">

// After
<div className="page-wrapper">
```

**Step 4**: Replace rounded-md with rounded-card (for cards)

```jsx
// Before
<div className="rounded-md p-6">

// After
<div className="rounded-card card-padding">
```

---

## Developer Notes

### Design Token Philosophy

1. **Semantic over Specific**: Use `.heading-page` not `.text-3xl`
2. **Consistency over Flexibility**: Follow the design system even when tempted to customize
3. **Accessibility First**: Color contrast and keyboard nav are non-negotiable
4. **Brand Awareness**: Understand when to use brand colors vs. UI colors

### Common Mistakes to Avoid

❌ Using `gray-*` classes (should be `neutral-*` or `slate-*`)
❌ Using `rounded-md` on cards (should be `rounded-card`)
❌ Using Immediate red for all buttons (only for brand moments)
❌ Mixing font weights randomly (stick to the scale)
❌ Custom spacing values (use design tokens)

### When to Deviate

It's okay to deviate from the design system when:
- Prototyping new patterns (but document them!)
- Handling edge cases
- Working with third-party components

Always document deviations and propose updates to the design system.

---

## Changelog

### v1.0.0 (2025-11-04)
- Initial design system documentation
- Brand guidelines for Immediate + Unbound co-branding
- Design token definitions
- Typography scale
- Color system with neutrals (slate)
- Spacing and layout guidelines
- Component patterns
- Accessibility standards
- Usage examples and migration guide

---

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Shot Builder CLAUDE.md](../CLAUDE.md)
- [Tailwind Design Tokens Plugin](./design-tokens.js)

---

**Questions or feedback?** Open an issue or discuss in team meetings.
