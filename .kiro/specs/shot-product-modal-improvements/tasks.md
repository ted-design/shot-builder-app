# Implementation Plan

- [x] 1. Fix modal scrolling and layout issues
  - Update the scrollable container padding to ensure action buttons are accessible
  - Adjust the sticky footer positioning and spacing
  - Test scrolling behavior across different content heights
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Enhance button state logic for improved workflow
  - Separate button enabling logic for "Add colourway" vs "Add & choose size" actions
  - Update button disabled states to reflect the new workflow requirements
  - Ensure loading states properly disable both action buttons
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.5_

- [x] 3. Update button labels and visual feedback
  - Ensure button labels clearly communicate their actions
  - Implement proper visual feedback for enabled/disabled states
  - Add appropriate button state indicators for size selection requirements
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Test and validate the improved modal behavior
  - Create test cases for the new button state logic
  - Verify scrolling works properly on different screen sizes
  - Test both workflow paths (add colourway vs add with size)
  - Validate that product data is correctly saved with pending size status
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_