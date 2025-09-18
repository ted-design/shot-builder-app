# Requirements Document

## Introduction

This feature addresses usability issues in the Shot Product Add Modal, specifically fixing scrolling problems that prevent users from accessing action buttons and improving the product selection workflow to allow colourway selection without mandatory size selection.

## Requirements

### Requirement 1

**User Story:** As a user adding products to shots, I want to be able to scroll through all available colourways and access the action buttons, so that I can complete my product selection without UI obstruction.

#### Acceptance Criteria

1. WHEN I open the product family details view THEN I SHALL be able to scroll through all colourways without any content being cut off
2. WHEN I scroll to the bottom of the colourway list THEN I SHALL be able to see and access the "Add colourway" and "Add & choose size now" buttons
3. WHEN the modal content exceeds the viewport height THEN the scrollable area SHALL have sufficient padding to ensure all interactive elements are accessible
4. WHEN I interact with the modal on different screen sizes THEN the scrolling behavior SHALL work consistently across desktop and mobile viewports

### Requirement 2

**User Story:** As a user planning shots, I want to add colourways to my shot without being required to specify sizes immediately, so that I can focus on creative decisions first and handle sizing logistics later.

#### Acceptance Criteria

1. WHEN I select a colourway THEN I SHALL be able to add it to the shot with a "pending size" status without selecting a specific size
2. WHEN I choose "Add colourway" THEN the system SHALL save the product with colourway information and mark size selection as pending
3. WHEN I view products with pending size status in the shot THEN I SHALL be able to identify which products need size specification
4. WHEN I want to specify a size immediately THEN I SHALL still have the option to use "Add & choose size now" for complete specification
5. WHEN I add a colourway without size THEN the product SHALL be saved with sizeScope set to "pending" and size set to null

### Requirement 3

**User Story:** As a user managing shot products, I want clear visual feedback about the selection state and available actions, so that I understand what will happen when I click action buttons.

#### Acceptance Criteria

1. WHEN I have selected a colourway THEN the "Add colourway" button SHALL be enabled and clearly indicate it will add without size selection
2. WHEN I have not selected any colourway THEN both action buttons SHALL be disabled with appropriate visual feedback
3. WHEN I select a size option THEN the "Add & choose size now" button SHALL be enabled and indicate it will add with the selected size
4. WHEN the size dropdown shows "Decide later" THEN the "Add & choose size now" button SHALL be disabled
5. WHEN loading family details THEN appropriate loading states SHALL be shown and action buttons SHALL be disabled