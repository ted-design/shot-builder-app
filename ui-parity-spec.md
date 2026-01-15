# UI Parity Spec: Shot Builder → SetHero Convergence

> **Goal**: Converge the Shot Builder call sheet builder UI toward SetHero's look and feel as a starting point.
>
> **Reference**: SetHero "Editing Call Sheet" screen
> **Target**: Shot Builder Schedule / Call Sheet Builder screen
>
> Screenshots saved to: `docs/ui/sethero.png` and `docs/ui/myapp.png`

---

## 1. Typography Comparison

| Element | SetHero | My App | Delta |
|---------|---------|--------|-------|
| **Font Family (Primary)** | `Lato, sans-serif` | `Inter, ui-sans-serif, system-ui` | Keep Inter (more modern), but consider Lato for call sheet preview for print fidelity |
| **Font Family (Decorative)** | `Lora, serif` (panel headers) | None | Add serif option for accent headers |
| **Base Font Size** | `14px` | `16px` | Reduce to 14px for denser UI |
| **Body Line Height** | `20px` (1.43) | `24px` (1.5) | Tighten to 1.43 |
| **Body Color** | `rgb(0, 0, 0)` / `rgba(0,0,0,0.87)` | `rgb(15, 23, 42)` (slate-900) | Keep slate-900, it's equivalent |
| **H1 (Project Title)** | `28px / 500` | Unknown | Add 28px/medium title style |
| **Section Header** | `13px / 400 / uppercase` | `16px / 400` | Reduce size, add uppercase for table headers |
| **Button Text** | `18.48px / 600` | `14px / 400` | Increase to 16px, weight to 500-600 |
| **Small/Label Text** | `13px` | `12px` | Close enough, keep 12px |
| **Letter Spacing** | `normal` | `normal` | No change |

### Typography Tokens to Add
```
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-serif: 'Lora', serif;  /* For decorative headers */
--text-xs: 12px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 16px;
--text-xl: 18px;
--text-2xl: 24px;
--text-3xl: 28px;
--line-height-tight: 1.25;
--line-height-normal: 1.43;
--line-height-relaxed: 1.5;
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
```

---

## 2. Color Comparison

| Element | SetHero | My App | Delta |
|---------|---------|--------|-------|
| **App Background** | `rgb(26, 43, 61)` #1a2b3d | `rgb(248, 250, 252)` #f8fafc | Different paradigm: SetHero dark sidebar + light content |
| **Sidebar Background** | `rgb(26, 43, 61)` #1a2b3d (dark navy) | `rgb(15, 23, 42)` #0f172a (slate-900) | Close! Keep slate-900, slightly darker |
| **Sidebar Width** | `220px` | `64px` (icon only) | Different approach - my app uses icon rail |
| **Layout Panel Background** | `rgb(224, 228, 235)` #e0e4eb | `transparent` | **Add light gray background** |
| **Preview Area Background** | Light gray (in iframe) | `rgb(248, 250, 252)` #f8fafc | Keep slate-50 |
| **Primary Button** | `rgb(31, 102, 217)` #1f66d9 | `rgb(99, 102, 241)` #6366f1 | **Key difference**: SetHero uses blue, we use indigo |
| **Primary Button Hover** | Unknown | Unknown | Need to capture |
| **Secondary Button** | `rgb(177, 192, 217)` #b1c0d9 | `transparent + border` | Consider filled secondary |
| **Text Primary** | `rgba(0, 0, 0, 0.87)` | `rgb(15, 23, 42)` | Equivalent |
| **Text Muted** | `rgb(34, 34, 34)` #222 | `rgb(100, 116, 139)` #64748b | SetHero darker muted text |
| **Border Color** | `rgba(214, 214, 214, 0.44)` | `rgb(226, 232, 240)` #e2e8f0 | Similar, keep slate-200 |
| **Table Header Bg** | Transparent/white | `rgb(99, 102, 241)` #6366f1 (indigo) | **Major diff**: SetHero uses text headers, we use colored bars |
| **Selected Item** | `rgb(31, 102, 217)` #1f66d9 | `rgb(99, 102, 241)` #6366f1 | Consistent with primary |

### Color Tokens to Add
```
/* Surfaces */
--color-bg: #f8fafc;           /* slate-50 - app background */
--color-surface: #ffffff;       /* white - cards/panels */
--color-surface-muted: #e0e4eb; /* light gray - layout panel bg (NEW) */
--color-sidebar: #0f172a;       /* slate-900 - sidebar */

/* Borders */
--color-border: #e2e8f0;        /* slate-200 */
--color-border-muted: rgba(214, 214, 214, 0.44);

/* Text */
--color-text: #0f172a;          /* slate-900 */
--color-text-muted: #64748b;    /* slate-500 */
--color-text-inverted: #ffffff;

/* Primary Action */
--color-primary: #6366f1;       /* indigo-500 (current) */
--color-primary-hover: #4f46e5; /* indigo-600 */
/* Alternative (SetHero blue): #1f66d9 */

/* Table */
--color-table-header: transparent;  /* SetHero style */
--color-table-header-text: #0f172a;
--color-table-border: rgba(214, 214, 214, 0.44);
--color-table-row-alt: #f9fafb;     /* subtle zebra striping */
```

---

## 3. Spacing & Layout Comparison

| Element | SetHero | My App | Delta |
|---------|---------|--------|-------|
| **Sidebar Width** | `220px` | `64px` | Different architecture (full nav vs icon rail) |
| **Layout Panel Width** | `340px` | `280px` | **Increase to 300-320px** |
| **Layout Panel Padding** | `0 29px 0 16px` | `0` | **Add horizontal padding** |
| **Top Nav Height** | `44px` (action bar) | `65px` | Reduce to ~48-52px |
| **Preview Card Padding** | In iframe, scaled | `0` | Add internal padding |
| **Button Height (Primary)** | `46px` | `40px` | Close, keep 40px |
| **Button Height (Secondary)** | `32px` | `32px` | Match |
| **Button Padding** | `5px 24px` | `8px 16px` | Increase horizontal to 20px |
| **Button Border Radius** | `6px` | `6px` | Match |
| **Table Row Height** | `32px` (header), `13px` (data - scaled) | Unknown | Target ~40-44px data rows |
| **Table Cell Padding** | `2px 0 4px 6px` (scaled) | Unknown | Target `8px 12px` |

### Spacing Tokens
```
/* Spacing Scale */
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;

/* Component-Specific */
--sidebar-width: 64px;              /* Icon rail */
--layout-panel-width: 320px;        /* Increase from 280px */
--layout-panel-padding-x: 16px;
--topbar-height: 52px;              /* Reduce from 65px */
--action-bar-height: 44px;

/* Table */
--table-header-height: 40px;
--table-row-height: 44px;
--table-cell-padding: 8px 12px;

/* Buttons */
--btn-height-sm: 32px;
--btn-height-md: 40px;
--btn-height-lg: 46px;
--btn-padding-x: 20px;
--btn-radius: 6px;
```

---

## 4. Border & Shadow Comparison

| Element | SetHero | My App | Delta |
|---------|---------|--------|-------|
| **Card Border Radius** | Unknown (in iframe) | `8px` | Keep 8px |
| **Card Shadow** | None visible | `none` | Match |
| **Card Border** | `1px solid` (light) | `0.56px solid #e2e8f0` | Increase to 1px |
| **Table Border** | `1px dashed #dadada` (sections) | Solid | **Change section dividers to dashed** |
| **Table Cell Border** | `1px solid rgba(214,214,214,0.44)` | Unknown | Use subtle borders |
| **Input Border Radius** | Unknown | `6px` | Keep |
| **Panel Border** | None visible | `0px` | No change |

### Border/Shadow Tokens
```
--radius-sm: 4px;
--radius-md: 6px;
--radius-lg: 8px;
--radius-xl: 12px;
--radius-full: 9999px;

--border-width: 1px;
--border-color: #e2e8f0;

--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
```

---

## 5. Controls Comparison

### Buttons

| Variant | SetHero | My App | Delta |
|---------|---------|--------|-------|
| **Primary** | Blue #1f66d9, 18px/600, 46px height | Indigo #6366f1, 14px/400, 40px | Increase font size/weight |
| **Secondary** | Gray #b1c0d9 filled | Transparent + border | Consider filled secondary |
| **Icon Button** | 24px circle, #444f5b | Various | Standardize to 32px circle |
| **Selected State** | Blue background | Indigo background | Consistent |

### Layout Panel Items

| State | SetHero | My App | Delta |
|-------|---------|--------|-------|
| **Default** | White/transparent bg, 14px text | Transparent, 16px text | Reduce to 14px |
| **Selected** | Blue #1f66d9 bg, white text | Indigo #6366f1 bg, white text | Match (just color diff) |
| **Hover** | Unknown | Unknown | Add subtle hover state |
| **With Icon** | Icon left, drag handle left | Icon left | Similar |
| **Padding** | ~12px horizontal | ~8px | Increase padding |

---

## 6. Tables (Call Sheet Preview)

| Property | SetHero | My App | Delta |
|----------|---------|--------|-------|
| **Header Style** | Text-only, dashed top border | Solid colored bar (indigo) | **Major change needed** |
| **Header Font** | 13px, normal weight, uppercase | 12px, normal, uppercase | Close |
| **Header Separator** | `1px dashed #dadada` | Solid bar | **Change to text headers with dashed dividers** |
| **Row Height** | ~32px (scaled) | Unknown | Target 40-44px |
| **Cell Padding** | `2px 6px` (scaled) | Unknown | Target 8px 12px |
| **Zebra Striping** | No | No | Match |
| **Column Dividers** | None visible | None | Match |
| **Border Color** | `rgba(214,214,214,0.44)` | Unknown | Add subtle borders |

### Table Token Additions
```
--table-header-bg: transparent;
--table-header-border: 1px dashed #dadada;
--table-header-font-size: 13px;
--table-header-font-weight: 400;
--table-header-text-transform: uppercase;
--table-cell-border: 1px solid rgba(214,214,214,0.44);
--table-row-height: 44px;
--table-cell-padding-y: 8px;
--table-cell-padding-x: 12px;
```

---

## 7. Key Visual Differences Summary

### High Impact Changes (Phase 1 Priority)

1. **Table Headers**: Change from solid colored bars to text-only headers with dashed top border
2. **Layout Panel Background**: Add `#e0e4eb` background color
3. **Typography Scale**: Reduce base to 14px, tighten line heights
4. **Button Typography**: Increase to 16px, font-weight 500-600

### Medium Impact Changes (Phase 2)

1. **Layout Panel Width**: Increase from 280px to 320px
2. **Layout Panel Padding**: Add 16px horizontal padding
3. **Top Bar Height**: Reduce from 65px to ~52px
4. **Table Row Heights**: Standardize to 44px

### Low Impact / Optional (Phase 3)

1. **Primary Color**: Consider switching from indigo to blue (optional)
2. **Secondary Buttons**: Consider filled style
3. **Serif Accent Font**: Add Lora for decorative headers

---

## 8. Implementation Notes

### Tailwind Integration Strategy

**Option A: CSS Variables + Tailwind Config (Recommended)**
1. Define tokens in `tokens.css` as CSS variables
2. Extend Tailwind config to use these variables
3. Create utility classes that reference tokens

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'surface-muted': 'var(--color-surface-muted)',
        'table-header': 'var(--color-table-header)',
      },
      spacing: {
        'layout-panel': 'var(--layout-panel-width)',
      },
      fontSize: {
        'base': ['var(--text-base)', { lineHeight: 'var(--line-height-normal)' }],
      }
    }
  }
}
```

**Option B: Direct Tailwind Classes**
- Use Tailwind's built-in values where they match
- Override specific components with custom CSS

### Files Likely to Change

- `src/components/callsheet/CallSheetBuilder.jsx` (or similar)
- `src/components/callsheet/SchedulePreview.jsx`
- `src/components/callsheet/LayoutPanel.jsx`
- `src/components/common/Button.jsx`
- `src/components/common/Table.jsx`
- `tailwind.config.js`
- `src/index.css` or `src/styles/tokens.css` (new)

---

## 9. Appendix: Raw Extracted Values

### SetHero Computed Styles
```json
{
  "sidebar": {
    "width": "220px",
    "backgroundColor": "rgb(26, 43, 61)"
  },
  "layoutPanel": {
    "width": "340px",
    "backgroundColor": "rgb(224, 228, 235)",
    "padding": "0px 28.8px 0px 16px"
  },
  "primaryButton": {
    "fontSize": "18.48px",
    "fontWeight": "600",
    "backgroundColor": "rgb(31, 102, 217)",
    "borderRadius": "6px",
    "height": "46px"
  },
  "fontFamily": "Lato, sans-serif",
  "baseFontSize": "14px",
  "tableCellBorder": "1px solid rgba(214, 214, 214, 0.44)",
  "tableHeaderBorder": "1px dashed rgb(218, 218, 218)"
}
```

### My App Computed Styles
```json
{
  "sidebar": {
    "width": "64px",
    "backgroundColor": "rgb(15, 23, 42)"
  },
  "layoutPanel": {
    "width": "280px",
    "backgroundColor": "transparent"
  },
  "primaryButton": {
    "fontSize": "14px",
    "fontWeight": "400",
    "backgroundColor": "rgb(99, 102, 241)",
    "borderRadius": "6px",
    "height": "40px"
  },
  "fontFamily": "Inter, ui-sans-serif, system-ui",
  "baseFontSize": "16px",
  "topNavHeight": "65px",
  "previewBackground": "rgb(248, 250, 252)"
}
```
