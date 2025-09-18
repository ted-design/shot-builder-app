# Design Document

## Overview

This design addresses two critical usability issues in the Shot Product Add Modal: fixing scrolling accessibility problems and improving the product selection workflow to support colourway-first selection without mandatory size specification.

## Architecture

The solution involves modifications to the existing `ShotProductAddModal` component without changing the overall modal architecture or data flow. The changes focus on:

1. **Layout improvements** - Adjusting the scrollable area padding and sticky footer positioning
2. **Button logic refinement** - Updating the action button states and submission logic
3. **Visual feedback enhancement** - Improving user understanding of available actions

## Components and Interfaces

### ShotProductAddModal Component Updates

#### Layout Structure
```jsx
<Modal>
  <Card>
    <CardHeader /> {/* Fixed header with title and navigation */}
    <div className="scrollable-container"> {/* Improved scrolling container */}
      <CardContent className="content-with-proper-padding">
        {/* Colourway selection content */}
      </CardContent>
      <div className="sticky-footer-with-proper-spacing">
        {/* Action buttons */}
      </div>
    </div>
  </Card>
</Modal>
```

#### Key Layout Changes
- **Scrollable container**: Ensure proper height calculation and overflow handling
- **Content padding**: Add sufficient bottom padding (pb-32 instead of pb-28) to account for sticky footer
- **Footer positioning**: Maintain sticky positioning while ensuring content accessibility

### Button State Logic

#### Current Button States
```javascript
// Current logic
const disableSave = !selectedFamilyId || !selectedColour;
const sizeRequired = !selectedSize || selectedSize === "";
```

#### Enhanced Button States
```javascript
// Enhanced logic
const hasValidSelection = selectedFamilyId && selectedColour;
const canAddColourway = hasValidSelection && !loadingDetails;
const canAddWithSize = hasValidSelection && selectedSize && selectedSize !== "" && !loadingDetails;
```

#### Button Behavior Matrix
| State | Add Colourway Button | Add & Choose Size Button |
|-------|---------------------|-------------------------|
| No colourway selected | Disabled | Disabled |
| Colourway selected, no size | Enabled | Disabled |
| Colourway selected, "Decide later" | Enabled | Disabled |
| Colourway selected, specific size | Enabled | Enabled |
| Colourway selected, "All sizes" | Enabled | Enabled |
| Loading details | Disabled | Disabled |

## Data Models

### Product Selection Data Structure

The existing data structure supports the workflow but needs clarification on status handling:

```typescript
interface ProductSelection {
  family: ProductFamily;
  colour: ProductColour;
  size: string | null;           // null when size is pending
  status: 'complete' | 'pending-size';
  sizeScope: 'single' | 'all' | 'pending';
}
```

#### Status Mapping
- **'pending-size'**: Colourway selected, size to be determined later
- **'complete'**: Both colourway and size specified
- **sizeScope 'pending'**: Indicates size selection is deferred
- **sizeScope 'single'**: Specific size selected
- **sizeScope 'all'**: All sizes selected

## Error Handling

### Scrolling Issues
- **Problem**: Content cut off by sticky footer
- **Solution**: Increase bottom padding and ensure proper container height calculation
- **Fallback**: If scrolling still fails, provide alternative navigation method

### Button State Confusion
- **Problem**: Users unclear about button functionality
- **Solution**: Clear button labels and disabled states with visual feedback
- **Validation**: Prevent submission with invalid selections

### Loading States
- **Problem**: Actions available during data loading
- **Solution**: Disable all action buttons during loading states
- **Feedback**: Show loading indicators for better user experience

## Testing Strategy

### Unit Tests
1. **Button state logic**: Test all combinations of selection states
2. **Submission data**: Verify correct data structure for both submission types
3. **Loading states**: Ensure proper button disabling during async operations

### Integration Tests
1. **Modal scrolling**: Test scrollability across different viewport sizes
2. **Workflow completion**: Test both "add colourway" and "add with size" flows
3. **Data persistence**: Verify correct product data is saved to shot

### Visual Regression Tests
1. **Modal layout**: Ensure footer doesn't obstruct content
2. **Button states**: Verify visual feedback for enabled/disabled states
3. **Responsive behavior**: Test modal behavior on mobile and desktop

### User Acceptance Tests
1. **Scrolling accessibility**: Users can access all colourways and buttons
2. **Workflow flexibility**: Users can add colourways without size pressure
3. **Clear actions**: Users understand what each button will do

## Implementation Notes

### CSS Adjustments
- Increase `pb-28` to `pb-32` or higher for better footer clearance
- Ensure sticky footer has proper backdrop blur and spacing
- Test scrolling behavior across different content heights

### Button Logic Updates
- Separate "can add colourway" from "can add with size" logic
- Update button labels for clarity if needed
- Ensure proper loading state handling

### Accessibility Considerations
- Maintain proper focus management during scrolling
- Ensure button states are announced to screen readers
- Keep keyboard navigation working properly with layout changes