# Screenshots Directory

## Screenshot Recreation Instructions

The visual analysis was performed via browser automation with screenshots captured in browser memory.
To recreate physical screenshot files for this parity analysis:

### SetHero Screenshots

1. **sethero_context.png**
   - URL: https://my.sethero.com/portal/23598/callsheet/68357/build/outline
   - Capture: Full page showing Layout panel + Preview
   - Note: Requires authentication

2. **sethero_focus.png**
   - Same URL, scroll down to see PRODUCTION and CAMERA crew tables
   - Capture: Zoomed view of crew table rows

### MyApp Screenshots

1. **myapp_context.png**
   - URL: http://localhost:5173/projects/K5UpgJI9qeIz2l2oIKQg/schedule?scheduleId=DYVTVcjeRH7tId0iBj3s
   - Capture: Full page showing Layout panel + Preview

2. **myapp_focus.png**
   - Same URL, scroll to page 2 of preview (Crew section)
   - Capture: UNASSIGNED crew table

### Capture Method

Using browser DevTools or screenshot tool:
```
1. Open Developer Tools (F12)
2. Click "Device toolbar" or press Ctrl+Shift+M
3. Set viewport to 1636x752 (matching analysis)
4. Use "Capture screenshot" from DevTools menu
5. Save with appropriate filename
```

Or use Claude-in-Chrome automation:
```
Navigate to URL → Wait 3s → Take screenshot
```

## Visual Analysis Summary

See `../notes/visual-observations.md` for detailed observations from the browser session analysis.
