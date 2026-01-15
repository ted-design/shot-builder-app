# Screenshots

Screenshots were captured during the investigation session but could not be saved to disk due to MCP tool limitations. The browser automation captured the following views:

## MyApp Screenshots (Described)

1. **Layout Panel Overview** - Shows the full call sheet builder with Layout panel on left
2. **Layout Panel Zoom** - Tight crop showing section rows with drag handles (::)
3. **Add Dropdown Open** - Top "+" button clicked, showing section types menu
4. **Row Menu Open** - Section actions menu showing "Add banner below…", "Add page break below"
5. **Hover Between Rows** - Gap between sections showing NO insertion control
6. **Hover on Drag Handle** - Subtle gray grip handle on row hover

## SetHero Screenshots (Described)

1. **Layout Overview** - Full SetHero call sheet builder view
2. **Layout Panel Zoom** - Shows blue "+" insertion button between sections
3. **Hover Add Section** - Clear view of "+" appearing on hover between rows
4. **Drag Handle Hover** - Row hover showing controls (eye, Edit button)

## Key Visual Observations

### SetHero Inline "+" Affordance
- Blue circular button (~24px)
- Appears between rows on hover
- Single click opens section type menu

### MyApp Gap (Missing Affordance)
- No visual control between rows
- Must use row menu (3 clicks) or top dropdown (2 clicks, appends to end)
- Gap between rows is ~6px (space-y-1.5)

## To Reproduce Screenshots

1. Open SetHero: https://my.sethero.com/portal/23598/callsheet/68357/build/outline
2. Open MyApp: http://localhost:5173/projects/K5UpgJI9qeIz2l2oIKQg/schedule?scheduleId=DYVTVcjeRH7tId0iBj3s
3. Compare Layout panels side-by-side
4. Hover between rows in each to see difference
