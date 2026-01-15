# Visual Observations from Screenshot Analysis

## Screenshots Captured (Browser Session)

Screenshots were captured via Claude-in-Chrome browser automation during the analysis session.
The images exist in browser memory with the following IDs:

| ID | Description |
|----|-------------|
| ss_0983quobc | SetHero - Initial context view |
| ss_29848il73 | SetHero - After scrolling to crew tables |
| ss_1286lj062 | SetHero - Zoomed PRODUCTION/CAMERA focus |
| ss_7935jnwe4 | MyApp - Initial context view |
| ss_8835r4kw2 | MyApp - Scrolled to crew section |
| ss_33467g4lp | SetHero - Final reference capture |

To recreate physical screenshot files, re-run browser automation to the same URLs.

---

## SetHero Crew Table Observations

### Overall Structure
- Crew tables organized by DEPARTMENT (PRODUCTION, CAMERA, GRIP & ELECTRIC, WARDROBE, HAIR & MAKEUP, MODEL MGMT, ARTIST MGMT, LOCATIONS, client name)
- Each department is a separate bordered table
- Department name appears as section header (grey background, uppercase)

### Row Layout (3-column structure)
```
| ROLE (left)          | NAME + CONTACT (center)              | CALL (right) |
|----------------------|--------------------------------------|--------------|
| Producer             | Ted Ghanime    (416) 897-0253        | 7:00 AM      |
|                      | ted@immediategroup.ca                |              |
| Producer             | Ryan Bergmann  (647) 923-1505        | 7:00 AM      |
|                      | r.bergmann@immediategroup.ca         |              |
```

### Typography
- Role: Regular weight, ~12px, left-aligned
- Name: Medium/bold weight, ~13px
- Phone: Regular weight, ~11px, same line as name
- Email: Regular weight, ~11px, blue link color, below name
- Call time: Regular weight, ~11px, right-aligned

### Visual Characteristics
- Row height: ~44-48px (accommodates 2 lines)
- Cell borders: Light grey, 1px
- Black header band for column titles
- Contact info uses blue (#1f66d9 or similar) for links
- Compact horizontal layout - Role takes ~30%, Contact ~55%, Call ~15%

---

## MyApp Crew Table Observations

### Overall Structure
- Single "UNASSIGNED" department grouping visible
- Table with separate columns (not stacked)
- Department name as black header band (similar to SetHero)

### Row Layout (5-column structure)
```
| ROLE       | NAME         | PHONE | EMAIL | CALL |
|------------|--------------|-------|-------|------|
| Unassigned | Ted Ghanime  | —     | —     | —    |
```

### Typography
- All cells: ~11px, single-line
- Name has medium weight
- Placeholders shown as "—" (em-dash)

### Visual Characteristics
- Row height: ~20px (single line only)
- Cell borders: Black, 1px (matches SetHero)
- Black header band for column titles (matches SetHero)
- 5 columns spread information horizontally
- Less dense, more whitespace per row

---

## Key Differences Summary

| Aspect | SetHero | MyApp |
|--------|---------|-------|
| Columns | 3 | 5 |
| Row height | ~44px | ~20px |
| Contact layout | Stacked (name + phone / email) | Separate columns |
| Information density | High | Low |
| Horizontal eye movement | Minimal | Wide |
| Scan speed | Fast | Slower |

---

## Measurement Notes

### SetHero Row Analysis
- Estimated from screenshot pixel measurements
- Row height includes 2 lines of text + padding
- Name line: ~16px including line-height
- Contact line: ~14px including line-height
- Vertical padding: ~6-8px top/bottom

### MyApp CSS Values (from tokens.css)
```css
--doc-table-row-height: 20px;
--doc-table-font-size: 11px;
--doc-table-header-font-size: 9px;
--doc-table-cell-padding-y: 2px;
--doc-table-cell-padding-x: 5px;
--doc-table-line-height: 1.15;
```

### Recommended MyApp Updates
```css
--doc-table-row-height: 36px;  /* Accommodate 2 lines */
```

The 36px recommendation assumes:
- Line 1 (name): 11px * 1.3 line-height = ~14px
- Line 2 (contact): 10px * 1.3 line-height = ~13px
- Vertical padding: 4px top + 5px bottom = 9px
- Total: 14 + 13 + 9 = 36px
