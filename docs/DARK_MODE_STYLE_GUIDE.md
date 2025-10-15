# Dark Mode Style Guide

## Overview

This guide documents the dark mode color system used throughout the Shot Builder app to ensure consistency and accessibility.

## Core Principles

1. **WCAG 2.1 AA Compliance**: All text must meet minimum contrast ratios
2. **Slate Color Scale**: Use slate colors (not gray) for consistency
3. **Indigo Accents**: Primary actions and active states use indigo colors
4. **Layered Backgrounds**: Create depth with subtle background variations
5. **Consistent Opacity**: Use standardized opacity levels (/5, /10, /20, /30, /50)

## Color System

### Background Hierarchy

```css
/* Deepest background (page background) */
dark:bg-slate-900        /* #0f172a */

/* Card background (elevated surface) */
dark:bg-slate-800        /* #1e293b */

/* Semi-transparent card background (dialogs, modals) */
dark:bg-slate-800/50     /* rgba(30, 41, 59, 0.5) */

/* Subtle hover background */
dark:hover:bg-slate-700  /* #334155 */
```

### Border Colors

```css
/* Standard borders */
dark:border-slate-700    /* #334155 */

/* Subtle borders (dashed, decorative) */
dark:border-slate-600    /* #475569 */

/* Accent borders (active, focused) */
dark:border-indigo-500   /* #6366f1 */
```

### Text Colors

```css
/* Primary headings (h1, h2, main titles) */
dark:text-slate-100      /* #f1f5f9 - Highest contrast */

/* Secondary headings (h3, emphasized text) */
dark:text-slate-200      /* #e2e8f0 - High contrast */

/* Body text (paragraphs, descriptions) */
dark:text-slate-300      /* #cbd5e1 - Standard contrast */

/* Metadata (stats, secondary info, icons) */
dark:text-slate-400      /* #94a3b8 - Medium contrast */

/* Muted text (timestamps, subtle labels) */
dark:text-slate-500      /* #64748b - Lower contrast (use sparingly) */
```

### Accent Colors

```css
/* Primary accent (buttons, active states, links) */
dark:text-indigo-400     /* #818cf8 */
dark:bg-indigo-500       /* #6366f1 */
dark:border-indigo-500   /* #6366f1 */

/* Active state backgrounds */
dark:bg-indigo-900/20    /* rgba(49, 46, 129, 0.2) */
dark:ring-indigo-500/30  /* rgba(99, 102, 241, 0.3) */

/* Hover states */
dark:hover:border-indigo-500/50  /* rgba(99, 102, 241, 0.5) */
```

## Component Patterns

### Card Component

```jsx
{/* Inactive card */}
<Card className="
  border-slate-200 dark:border-slate-700
  bg-white dark:bg-slate-800
  hover:border-primary/40 dark:hover:border-indigo-500/40
">

{/* Active card with ring effect */}
<Card className="
  border-primary dark:border-indigo-500
  bg-primary/5 dark:bg-indigo-900/20
  ring-2 ring-primary/20 dark:ring-indigo-500/30
  shadow-md
">
```

### Text Hierarchy

```jsx
{/* Primary heading */}
<h1 className="text-slate-900 dark:text-slate-100">

{/* Secondary heading */}
<h2 className="text-slate-800 dark:text-slate-200">

{/* Body text */}
<p className="text-slate-700 dark:text-slate-300">

{/* Metadata */}
<span className="text-slate-600 dark:text-slate-400">

{/* Timestamp */}
<span className="text-slate-500 dark:text-slate-400">  {/* Note: Use slate-400 for better contrast */}
```

### Button States

```jsx
{/* Primary button */}
<button className="
  bg-primary dark:bg-indigo-500
  text-white dark:text-white
  hover:bg-primary-dark dark:hover:bg-indigo-600
">

{/* Outline button */}
<button className="
  border-slate-200 dark:border-slate-700
  text-slate-700 dark:text-slate-300
  hover:bg-slate-100 dark:hover:bg-slate-700
">

{/* Ghost button */}
<button className="
  text-slate-600 dark:text-slate-400
  hover:bg-slate-100 dark:hover:bg-slate-700
  hover:text-slate-900 dark:hover:text-slate-200
">
```

### Icon Colors

```jsx
{/* Metadata icons (should match text color) */}
<Camera className="
  h-4 w-4
  text-slate-500 dark:text-slate-400
" aria-hidden="true" />

{/* Active state icons */}
<span className="
  inline-block w-2 h-2 rounded-full
  bg-primary dark:bg-indigo-400
  animate-pulse
" />
```

### Form Inputs

```jsx
{/* Text input */}
<input className="
  bg-white dark:bg-slate-800
  border-slate-200 dark:border-slate-700
  text-slate-900 dark:text-slate-100
  placeholder:text-slate-400 dark:placeholder:text-slate-500
  focus:ring-primary dark:focus:ring-indigo-500
  focus:border-primary dark:focus:border-indigo-500
" />

{/* Checkbox */}
<input type="checkbox" className="
  border-slate-300 dark:border-slate-600
  text-primary dark:text-indigo-500
  focus:ring-primary/80 dark:focus:ring-indigo-500/80
" />
```

### Dropdown/Modal

```jsx
{/* Dropdown panel */}
<div className="
  bg-white dark:bg-slate-800
  border border-slate-200 dark:border-slate-700
  shadow-lg
  animate-fade-in-down
  z-50
">

{/* Dropdown item */}
<button className="
  text-slate-700 dark:text-slate-300
  hover:bg-slate-100 dark:hover:bg-slate-700
  focus:outline-none
  focus-visible:ring-2
  focus-visible:ring-primary/80 dark:focus-visible:ring-indigo-500
">
```

## Opacity Scale

Use consistent opacity levels for visual hierarchy:

```css
/* Subtle tint */
/5   /* 5% opacity */

/* Light tint */
/10  /* 10% opacity */

/* Medium tint */
/20  /* 20% opacity */

/* Noticeable tint */
/30  /* 30% opacity */

/* Semi-transparent */
/50  /* 50% opacity */
```

### Common Uses

```jsx
{/* Active background tint */}
dark:bg-indigo-900/20

{/* Ring effect */}
dark:ring-indigo-500/30

{/* Semi-transparent overlay */}
dark:bg-slate-800/50

{/* Hover border */}
dark:hover:border-indigo-500/40
```

## Contrast Requirements

### Text Contrast (WCAG 2.1 AA)

| Text Size | Font Weight | Minimum Ratio | Recommended Colors |
|-----------|-------------|---------------|-------------------|
| < 14pt    | Regular     | 4.5:1         | slate-100, slate-200, slate-300, slate-400 on slate-800 |
| < 14pt    | Bold        | 4.5:1         | slate-100, slate-200, slate-300, slate-400 on slate-800 |
| ≥ 14pt    | Bold        | 3:1           | slate-100, slate-200, slate-300, indigo-400 on slate-800 |
| ≥ 18pt    | Regular     | 3:1           | slate-100, slate-200, slate-300, indigo-400 on slate-800 |

### UI Component Contrast

| Element | Minimum Ratio | Examples |
|---------|---------------|----------|
| Borders | 3:1           | slate-700, slate-600, indigo-500 on slate-800 |
| Icons   | 3:1           | slate-400, indigo-400 on slate-800 |
| Focus indicators | 3:1  | ring-indigo-500 on slate-800 |

## Common Pitfalls

### ❌ Don't

```jsx
{/* Don't use gray colors (inconsistent) */}
<div className="dark:bg-gray-800">        {/* Use slate-800 */}
<p className="dark:text-gray-400">        {/* Use slate-400 */}

{/* Don't use slate-500 for small text (low contrast) */}
<span className="text-xs dark:text-slate-500">  {/* Use slate-400 */}

{/* Don't mix color scales */}
<div className="dark:bg-zinc-800 dark:text-slate-200">  {/* Stay with slate */}

{/* Don't forget hover states */}
<button className="dark:bg-slate-800">   {/* Add dark:hover:bg-slate-700 */}
```

### ✅ Do

```jsx
{/* Use slate color scale consistently */}
<div className="dark:bg-slate-800">
<p className="dark:text-slate-400">

{/* Use slate-400 for better contrast on small text */}
<span className="text-xs dark:text-slate-400">

{/* Stay within the same color family */}
<div className="dark:bg-slate-800 dark:text-slate-200">

{/* Always include hover states */}
<button className="dark:bg-slate-800 dark:hover:bg-slate-700">
```

## Testing Dark Mode

### Manual Testing

1. Toggle dark mode with ThemeToggle component
2. Check all text is readable
3. Verify hover/focus states are visible
4. Ensure icons maintain proper contrast
5. Test in different browsers

### Automated Testing

```bash
# Run contrast validation
npm run test:a11y

# Check for missing dark mode classes
npm run lint:dark-mode
```

### Browser DevTools

```javascript
// Toggle dark mode in console
document.documentElement.classList.toggle('dark');

// Check computed colors
getComputedStyle(element).color;
getComputedStyle(element).backgroundColor;
```

## Implementation Checklist

When adding dark mode to a component:

- [ ] Background colors (`dark:bg-*`)
- [ ] Text colors (`dark:text-*`)
- [ ] Border colors (`dark:border-*`)
- [ ] Hover states (`dark:hover:*`)
- [ ] Focus states (`dark:focus-visible:*`)
- [ ] Icon colors (should match adjacent text)
- [ ] Active/selected states
- [ ] Disabled states
- [ ] Placeholder text (inputs)
- [ ] Shadow adjustments (if needed)

## Examples from ProjectCard

```jsx
{/* Card with comprehensive dark mode */}
<Card className={`
  ${isActive
    ? "border-primary dark:border-indigo-500 bg-primary/5 dark:bg-indigo-900/20 ring-2 ring-primary/20 dark:ring-indigo-500/30"
    : "border-slate-200 dark:border-slate-700 hover:border-primary/40 dark:hover:border-indigo-500/40"
  }
  transition-all duration-150
  hover:shadow-md
`}>
  {/* Project name */}
  <div className={`
    text-lg font-semibold
    ${isActive ? 'text-primary dark:text-indigo-400' : 'text-slate-900 dark:text-slate-100'}
  `}>
    {project?.name}
  </div>

  {/* Shoot dates */}
  <div className="
    flex items-center gap-1.5
    text-base font-semibold
    text-slate-800 dark:text-slate-200
  ">
    <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
    <span>{shootDates}</span>
  </div>

  {/* Metadata stats */}
  <div className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-400">
    <span className="flex items-center gap-1.5">
      <Camera className="h-4 w-4 text-slate-500 dark:text-slate-400" />
      <span>{shotCount} shots</span>
    </span>
  </div>

  {/* Timestamp */}
  <span className="text-xs text-slate-500 dark:text-slate-400">
    Updated {updatedAt}
  </span>

  {/* Active indicator */}
  {isActive && (
    <span className="flex items-center gap-1.5 text-primary dark:text-indigo-400 font-medium">
      <span className="inline-block w-2 h-2 rounded-full bg-primary dark:bg-indigo-400 animate-pulse" />
      Current project
    </span>
  )}
</Card>
```

## Resources

- [Tailwind Dark Mode Documentation](https://tailwindcss.com/docs/dark-mode)
- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Tailwind Slate Color Scale](https://tailwindcss.com/docs/customizing-colors#color-palette-reference)

## Changelog

### 2025-10-15
- Initial dark mode style guide created
- Documented ProjectCard dark mode patterns
- Added WCAG contrast validation
- Fixed timestamp contrast issue (slate-500 → slate-400)
