import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShotProductAddModal from "../ShotProductAddModal";

// Mock the useStorageImage hook
vi.mock("../../../hooks/useStorageImage", () => ({
    useStorageImage: vi.fn(() => "mock-image-url"),
}));

const mockFamilies = [
    {
        id: "family1",
        styleName: "Test Style",
        styleNumber: "TS001",
        colorNames: ["Red", "Blue"],
        archived: false,
        sizes: ["S", "M", "L"],
    },
];

const mockFamilyDetails = {
    colours: [
        {
            id: "color1",
            colorName: "Red",
            skuCode: "RED001",
            status: "active",
            imagePath: "path/to/red.jpg",
        },
        {
            id: "color2",
            colorName: "Blue",
            skuCode: "BLUE001",
            status: "active",
            imagePath: "path/to/blue.jpg",
        },
    ],
    sizes: ["S", "M", "L"],
};

const defaultProps = {
    open: true,
    families: mockFamilies,
    loadFamilyDetails: vi.fn(() => Promise.resolve(mockFamilyDetails)),
    onSubmit: vi.fn(),
    onClose: vi.fn(),
};

describe("ShotProductAddModal - Comprehensive Test Suite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("Button State Logic Tests", () => {
        it("disables both buttons when no colourway is selected", async () => {
            // Mock family details with no colours to test empty state
            const emptyFamilyDetails = { colours: [], sizes: ["S", "M", "L"] };
            const propsWithEmptyColors = {
                ...defaultProps,
                loadFamilyDetails: vi.fn(() => Promise.resolve(emptyFamilyDetails)),
            };

            render(<ShotProductAddModal {...propsWithEmptyColors} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            // Both buttons should be disabled when no colours available
            expect(addColourwayButton).toBeDisabled();
            expect(addWithSizeButton).toBeDisabled();
        });

        it("enables 'Add colourway' button when colourway is selected, keeps 'Add & choose size' disabled when no size selected", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load and verify auto-selection
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            // Add colourway should be enabled (auto-selected), Add & choose size should be disabled (no size selected)
            expect(addColourwayButton).not.toBeDisabled();
            expect(addWithSizeButton).toBeDisabled();
        });

        it("enables both buttons when colourway and specific size are selected", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select a specific size
            const sizeSelect = screen.getByRole("combobox");
            fireEvent.change(sizeSelect, { target: { value: "M" } });

            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add with M");

            // Both buttons should be enabled
            expect(addColourwayButton).not.toBeDisabled();
            expect(addWithSizeButton).not.toBeDisabled();
        });

        it("enables both buttons when colourway is selected and 'All sizes' is chosen", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select "All sizes"
            const sizeSelect = screen.getByRole("combobox");
            fireEvent.change(sizeSelect, { target: { value: "__ALL_SIZES__" } });

            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add all sizes");

            // Both buttons should be enabled
            expect(addColourwayButton).not.toBeDisabled();
            expect(addWithSizeButton).not.toBeDisabled();
        });

        it("disables both buttons during loading state", async () => {
            // Create a mock that returns a pending promise to simulate loading
            const loadingPromise = new Promise(() => {}); // Never resolves
            const loadingProps = {
                ...defaultProps,
                loadFamilyDetails: vi.fn(() => loadingPromise),
            };

            render(<ShotProductAddModal {...loadingProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            // Wait for loading state to appear
            await waitFor(() => {
                expect(screen.getByText("Loading colourways…")).toBeInTheDocument();
            });

            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            // Both buttons should be disabled during loading
            expect(addColourwayButton).toBeDisabled();
            expect(addWithSizeButton).toBeDisabled();
        });

        it("keeps 'Add & choose size' disabled when 'Decide later' is selected", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Ensure "Decide later" is selected (default state)
            const sizeSelect = screen.getByRole("combobox");
            expect(sizeSelect.value).toBe("");

            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            // Add colourway should be enabled, Add & choose size should be disabled
            expect(addColourwayButton).not.toBeDisabled();
            expect(addWithSizeButton).toBeDisabled();
        });
    });

    describe("Workflow Path Tests", () => {
        it("successfully completes 'Add colourway' workflow with pending size status", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Click "Add colourway" (should be enabled with auto-selected color)
            const addColourwayButton = screen.getByText("Add colourway");
            fireEvent.click(addColourwayButton);

            // Verify correct data is submitted
            expect(defaultProps.onSubmit).toHaveBeenCalledWith({
                family: mockFamilies[0],
                colour: mockFamilyDetails.colours[0],
                size: null,
                status: "pending-size",
                sizeScope: "pending",
            });

            // Verify modal closes
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it("successfully completes 'Add & choose size now' workflow with specific size", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select a specific size
            const sizeSelect = screen.getByRole("combobox");
            fireEvent.change(sizeSelect, { target: { value: "M" } });

            // Click "Add with M"
            const addWithSizeButton = screen.getByText("Add with M");
            fireEvent.click(addWithSizeButton);

            // Verify correct data is submitted
            expect(defaultProps.onSubmit).toHaveBeenCalledWith({
                family: mockFamilies[0],
                colour: mockFamilyDetails.colours[0],
                size: "M",
                status: "complete",
                sizeScope: "single",
            });

            // Verify modal closes
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it("successfully completes 'Add all sizes' workflow", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select "All sizes"
            const sizeSelect = screen.getByRole("combobox");
            fireEvent.change(sizeSelect, { target: { value: "__ALL_SIZES__" } });

            // Click "Add all sizes"
            const addWithSizeButton = screen.getByText("Add all sizes");
            fireEvent.click(addWithSizeButton);

            // Verify correct data is submitted
            expect(defaultProps.onSubmit).toHaveBeenCalledWith({
                family: mockFamilies[0],
                colour: mockFamilyDetails.colours[0],
                size: null,
                status: "complete",
                sizeScope: "all",
            });

            // Verify modal closes
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it("allows switching between colourways and maintains proper button states", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Initially Red should be auto-selected
            const redButton = screen.getByText("Red");
            const blueButton = screen.getByText("Blue");
            
            // Switch to Blue
            fireEvent.click(blueButton);

            // Verify buttons are still properly enabled/disabled
            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            expect(addColourwayButton).not.toBeDisabled();
            expect(addWithSizeButton).toBeDisabled(); // No size selected

            // Add a size
            const sizeSelect = screen.getByRole("combobox");
            fireEvent.change(sizeSelect, { target: { value: "L" } });

            // Now both buttons should be enabled
            expect(addColourwayButton).not.toBeDisabled();
            expect(screen.getByText("Add with L")).not.toBeDisabled();
        });
    });

    describe("Scrolling and Layout Tests", () => {
        it("renders with proper scrollable container structure", () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Check that the scrollable container exists with proper attributes
            const scrollContainer = screen.getByRole("dialog").querySelector('[tabindex="0"]');
            expect(scrollContainer).toBeInTheDocument();
            expect(scrollContainer).toHaveClass("flex-1", "overflow-y-auto", "overscroll-contain");
            expect(scrollContainer).toHaveAttribute("tabindex", "0");
        });

        it("has sufficient bottom padding to clear sticky footer", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Check that content has proper bottom padding
            const cardContent = screen.getByRole("dialog").querySelector('.space-y-4.pb-32');
            expect(cardContent).toBeInTheDocument();
            expect(cardContent).toHaveClass("pb-32");
        });

        it("renders sticky footer with proper styling and accessibility", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Check sticky footer exists and has proper classes
            const stickyFooter = screen.getByRole("dialog").querySelector('.sticky.bottom-0');
            expect(stickyFooter).toBeInTheDocument();
            expect(stickyFooter).toHaveClass(
                "sticky",
                "bottom-0",
                "bg-white/95",
                "backdrop-blur-sm",
                "shadow-lg",
                "py-4"
            );
        });

        it("action buttons are accessible in the sticky footer", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Check that action buttons are present and accessible
            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");
            const cancelButton = screen.getByText("Cancel");

            expect(addColourwayButton).toBeInTheDocument();
            expect(addWithSizeButton).toBeInTheDocument();
            expect(cancelButton).toBeInTheDocument();

            // Verify buttons are in the sticky footer
            const stickyFooter = screen.getByRole("dialog").querySelector('.sticky.bottom-0');
            expect(stickyFooter).toContainElement(addColourwayButton);
            expect(stickyFooter).toContainElement(addWithSizeButton);
            expect(stickyFooter).toContainElement(cancelButton);
        });

        it("handles different content heights properly with many colourways", async () => {
            // Create a family with many colors to test scrolling with more content
            const manyColorsFamilyDetails = {
                colours: Array.from({ length: 20 }, (_, i) => ({
                    id: `color${i}`,
                    colorName: `Color ${i}`,
                    skuCode: `COL${i.toString().padStart(3, '0')}`,
                    status: "active",
                    imagePath: `path/to/color${i}.jpg`,
                })),
                sizes: ["XS", "S", "M", "L", "XL", "XXL"],
            };

            const propsWithManyColors = {
                ...defaultProps,
                loadFamilyDetails: vi.fn(() => Promise.resolve(manyColorsFamilyDetails)),
            };

            render(<ShotProductAddModal {...propsWithManyColors} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Color 0")).toBeInTheDocument();
            });

            // Verify that with many colors, the layout still works
            const colorButtons = screen.getAllByRole("button").filter(btn =>
                btn.textContent.startsWith("Color ")
            );
            expect(colorButtons.length).toBe(20);

            // Verify sticky footer is still accessible
            const addColourwayButton = screen.getByText("Add colourway");
            expect(addColourwayButton).toBeInTheDocument();

            // Verify scrollable container maintains proper structure
            const scrollContainer = screen.getByRole("dialog").querySelector('[tabindex="0"]');
            expect(scrollContainer).toHaveClass("overflow-y-auto");
        });

        it("maintains focus management with scrollable container", () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Check that the scrollable container can receive focus
            const scrollContainer = screen.getByRole("dialog").querySelector('[tabindex="0"]');
            expect(scrollContainer).toHaveAttribute("tabindex", "0");
            expect(scrollContainer).toHaveClass("focus-visible:outline-none");
        });
    });

    describe("Data Validation Tests", () => {
        it("validates that product data is correctly saved with pending size status", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Click "Add colourway" to save with pending size
            const addColourwayButton = screen.getByText("Add colourway");
            fireEvent.click(addColourwayButton);

            // Verify the exact data structure matches requirements
            expect(defaultProps.onSubmit).toHaveBeenCalledWith({
                family: expect.objectContaining({
                    id: "family1",
                    styleName: "Test Style",
                    styleNumber: "TS001",
                }),
                colour: expect.objectContaining({
                    id: "color1",
                    colorName: "Red",
                    skuCode: "RED001",
                    status: "active",
                }),
                size: null, // Requirement 2.5: size set to null
                status: "pending-size", // Requirement 2.2: pending size status
                sizeScope: "pending", // Requirement 2.5: sizeScope set to "pending"
            });
        });

        it("validates that product data is correctly saved with complete status and specific size", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select a specific size
            const sizeSelect = screen.getByRole("combobox");
            fireEvent.change(sizeSelect, { target: { value: "M" } });

            // Click "Add with M"
            const addWithSizeButton = screen.getByText("Add with M");
            fireEvent.click(addWithSizeButton);

            // Verify the exact data structure for complete status
            expect(defaultProps.onSubmit).toHaveBeenCalledWith({
                family: expect.objectContaining({
                    id: "family1",
                    styleName: "Test Style",
                }),
                colour: expect.objectContaining({
                    id: "color1",
                    colorName: "Red",
                }),
                size: "M", // Specific size selected
                status: "complete", // Complete status
                sizeScope: "single", // Single size scope
            });
        });

        it("validates that product data is correctly saved with all sizes", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select "All sizes"
            const sizeSelect = screen.getByRole("combobox");
            fireEvent.change(sizeSelect, { target: { value: "__ALL_SIZES__" } });

            // Click "Add all sizes"
            const addWithSizeButton = screen.getByText("Add all sizes");
            fireEvent.click(addWithSizeButton);

            // Verify the exact data structure for all sizes
            expect(defaultProps.onSubmit).toHaveBeenCalledWith({
                family: expect.objectContaining({
                    id: "family1",
                    styleName: "Test Style",
                }),
                colour: expect.objectContaining({
                    id: "color1",
                    colorName: "Red",
                }),
                size: null, // Size is null for "all sizes"
                status: "complete", // Complete status
                sizeScope: "all", // All sizes scope
            });
        });
    });

    describe("Visual Feedback Tests", () => {
        it("shows proper visual feedback for button states", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Check initial state feedback
            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            // Add colourway should be enabled (not have opacity-40 class)
            expect(addColourwayButton).not.toHaveClass("opacity-40");
            expect(addColourwayButton).not.toBeDisabled();

            // Add & choose size should be disabled (have opacity-40 class)
            expect(addWithSizeButton).toHaveClass("opacity-40");
            expect(addWithSizeButton).toBeDisabled();

            // Check helper text
            expect(screen.getByText("Select a size to enable")).toBeInTheDocument();
        });

        it("shows loading state visual feedback", async () => {
            // Create a mock that returns a pending promise to simulate loading
            const loadingPromise = new Promise(() => {}); // Never resolves
            const loadingProps = {
                ...defaultProps,
                loadFamilyDetails: vi.fn(() => loadingPromise),
            };

            render(<ShotProductAddModal {...loadingProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            // Wait for loading state to appear
            await waitFor(() => {
                expect(screen.getByText("Loading colourways…")).toBeInTheDocument();
            });

            // Check that loading feedback is shown
            const loadingTexts = screen.getAllByText("Loading...");
            expect(loadingTexts.length).toBeGreaterThan(0);

            // Both buttons should have visual disabled state
            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            expect(addColourwayButton).toBeDisabled();
            expect(addWithSizeButton).toBeDisabled();
        });

        it("shows colourway selection visual feedback", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Check that selected colourway shows visual feedback
            expect(screen.getByText("✓ Red selected")).toBeInTheDocument();

            // Switch to Blue
            const blueButton = screen.getByText("Blue");
            fireEvent.click(blueButton);

            // Check that selection feedback updates
            expect(screen.getByText("✓ Blue selected")).toBeInTheDocument();
        });

        it("shows size selection visual feedback", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            fireEvent.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Initially colourway feedback should be shown (auto-selected), but no size feedback
            expect(screen.getByText("✓ Red selected")).toBeInTheDocument();
            expect(screen.queryByText(/✓.*size.*selected/)).toBeNull();

            // Select a size
            const sizeSelect = screen.getByRole("combobox");
            fireEvent.change(sizeSelect, { target: { value: "M" } });

            // Check that size selection feedback appears
            expect(screen.getByText("✓ M selected")).toBeInTheDocument();
            expect(screen.getByText("Only size M will be added to the shot")).toBeInTheDocument();

            // Select all sizes
            fireEvent.change(sizeSelect, { target: { value: "__ALL_SIZES__" } });

            // Check all sizes feedback
            expect(screen.getByText("✓ All sizes selected")).toBeInTheDocument();
            expect(screen.getByText("All available sizes will be added to the shot")).toBeInTheDocument();
        });
    });
});