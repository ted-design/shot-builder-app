import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "../../../test-utils/userEvent";
import ShotProductAddModal from "../ShotProductAddModal";

const appImageMock = vi.fn();

vi.mock("../../../components/common/AppImage", () => ({
    __esModule: true,
    default: (props) => {
        appImageMock(props);
        return <div data-testid="app-image" />;
    },
}));

const mockFamilies = [
  {
    id: "family1",
    styleName: "Test Style",
    styleNumber: "TS001",
    colorNames: ["Red", "Blue"],
    archived: false,
    sizes: ["S", "M", "L"],
    gender: "women",
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

describe("ShotProductAddModal - Task 4 Validation Tests", () => {
    let user;

    beforeEach(() => {
        vi.clearAllMocks();
        user = userEvent.setup();
    });

    describe("Button State Logic Tests (Requirements 2.1, 2.2, 2.4, 3.1, 3.2, 3.5)", () => {
        it("enables 'Add colourway' when colourway is selected, keeps 'Add & choose size' disabled when no size selected", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load (auto-selected)
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            // Add colourway should be enabled (auto-selected), Add & choose size should be disabled (no size selected)
            expect(addColourwayButton).not.toBeDisabled();
            expect(addWithSizeButton).toBeDisabled();
            expect(addWithSizeButton).toHaveClass("opacity-40");
        });

        it("enables both buttons when colourway and specific size are selected", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select a specific size
            const sizeSelect = screen.getByRole("combobox");
            await user.selectOptions(sizeSelect, "M");

            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add with M");

            // Both buttons should be enabled
            expect(addColourwayButton).not.toBeDisabled();
            expect(addWithSizeButton).not.toBeDisabled();
            expect(addColourwayButton).not.toHaveClass("opacity-40");
            expect(addWithSizeButton).not.toHaveClass("opacity-40");
        });

        it("enables both buttons when colourway is selected and 'All sizes' is chosen", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select "All sizes"
            const sizeSelect = screen.getByRole("combobox");
            await user.selectOptions(sizeSelect, "__ALL_SIZES__");

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
            await user.click(familyButton);

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
            await user.click(familyButton);

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

    describe("Workflow Path Tests (Requirements 2.1, 2.2, 2.3, 2.4, 2.5)", () => {
        it("successfully completes 'Add colourway' workflow with pending size status", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Click "Add colourway" (should be enabled with auto-selected color)
            const addColourwayButton = screen.getByText("Add colourway");
            await user.click(addColourwayButton);

            // Verify correct data is submitted (Requirement 2.5)
            expect(defaultProps.onSubmit).toHaveBeenCalledWith({
                family: mockFamilies[0],
                colour: mockFamilyDetails.colours[0],
                size: null, // Requirement 2.5: size set to null
                status: "pending-size", // Requirement 2.2: pending size status
                sizeScope: "pending", // Requirement 2.5: sizeScope set to "pending"
            });

            // Verify modal closes
            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it("successfully completes 'Add & choose size now' workflow with specific size", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select a specific size
            const sizeSelect = screen.getByRole("combobox");
            await user.selectOptions(sizeSelect, "M");

            // Click "Add with M"
            const addWithSizeButton = screen.getByText("Add with M");
            await user.click(addWithSizeButton);

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
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select "All sizes"
            const sizeSelect = screen.getByRole("combobox");
            await user.selectOptions(sizeSelect, "__ALL_SIZES__");

            // Click "Add all sizes"
            const addWithSizeButton = screen.getByText("Add all sizes");
            await user.click(addWithSizeButton);

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
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Initially Red should be auto-selected
            const blueButton = screen.getByText("Blue");
            
            // Switch to Blue
            await user.click(blueButton);

            // Verify buttons are still properly enabled/disabled
            const addColourwayButton = screen.getByText("Add colourway");
            const addWithSizeButton = screen.getByText("Add & choose size now");

            expect(addColourwayButton).not.toBeDisabled();
            expect(addWithSizeButton).toBeDisabled(); // No size selected

            // Add a size
            const sizeSelect = screen.getByRole("combobox");
            await user.selectOptions(sizeSelect, "L");

            // Now both buttons should be enabled
            expect(addColourwayButton).not.toBeDisabled();
            expect(screen.getByText("Add with L")).not.toBeDisabled();
        });
    });

    describe("Scrolling and Layout Tests (Requirements 1.1, 1.2, 1.3, 1.4)", () => {
        it("renders with proper scrollable container structure", () => {
            render(<ShotProductAddModal {...defaultProps} />);

            const dialog = screen.getByRole("dialog");
            const scrollContainer = within(dialog).getByTestId("shot-product-scroll-region");

            expect(scrollContainer).toBeInTheDocument();
            expect(scrollContainer).toHaveClass("flex-1");
            expect(scrollContainer).toHaveClass("overflow-y-auto");
            expect(scrollContainer).toHaveClass("overscroll-contain");
            expect(scrollContainer).toHaveAttribute("tabindex", "0");
        });

        it("has sufficient bottom padding to clear sticky footer (Requirement 1.2)", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            const dialog = screen.getByRole("dialog");
            const cardContent = within(dialog).getByTestId("shot-product-card-content");

            expect(cardContent).toHaveClass("space-y-4");
            expect(cardContent).toHaveClass("pb-6");
        });

        it("renders sticky footer with proper styling and accessibility (Requirement 1.2)", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            const dialog = screen.getByRole("dialog");
            const stickyFooter = within(dialog).getByTestId("shot-product-modal-footer");

            expect(stickyFooter).toHaveClass(
                "shrink-0",
                "border-t",
                "border-slate-200",
                "bg-white",
                "px-4",
                "pt-4",
                "sm:px-6",
                "pb-[max(env(safe-area-inset-bottom),1rem)]"
            );
            expect(stickyFooter).toHaveClass(
                "shadow-[0_-4px_12px_rgba(15,23,42,0.08)]"
            );
        });

        it("action buttons are accessible in the sticky footer (Requirement 1.2)", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            const dialog = screen.getByRole("dialog");
            const stickyFooter = within(dialog).getByTestId("shot-product-modal-footer");

            const addColourwayButton = within(stickyFooter).getByRole("button", { name: /add colourway/i });
            const addWithSizeButton = within(stickyFooter).getByRole("button", { name: /add & choose size now/i });
            const cancelButton = within(stickyFooter).getByRole("button", { name: /cancel/i });

            expect(addColourwayButton).toBeInTheDocument();
            expect(addWithSizeButton).toBeInTheDocument();
            expect(cancelButton).toBeInTheDocument();
        });

        it("handles different content heights properly with many colourways (Requirement 1.4)", async () => {
            const manyColorsFamilyDetails = {
                colours: Array.from({ length: 20 }, (_, i) => ({
                    id: `color${i}`,
                    colorName: `Color ${i}`,
                    skuCode: `COL${i.toString().padStart(3, "0")}`,
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

            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.getByText("Color 0")).toBeInTheDocument();
            });

            const dialog = screen.getByRole("dialog");
            const colorButtons = within(dialog)
                .getAllByRole("button")
                .filter((btn) => btn.textContent?.startsWith("Color "));
            expect(colorButtons.length).toBe(20);

            const stickyFooter = within(dialog).getByTestId("shot-product-modal-footer");
            const addColourwayButton = within(stickyFooter).getByRole("button", { name: /add colourway/i });
            expect(addColourwayButton).toBeInTheDocument();

            const scrollContainer = within(dialog).getByTestId("shot-product-scroll-region");
            expect(scrollContainer).toHaveClass("overflow-y-auto");
        });

        it("maintains focus management with scrollable container (Requirement 1.3)", () => {
            render(<ShotProductAddModal {...defaultProps} />);

            const dialog = screen.getByRole("dialog");
            const scrollContainer = within(dialog).getByTestId("shot-product-scroll-region");

            expect(scrollContainer).toHaveAttribute("tabindex", "0");
            expect(scrollContainer).toHaveClass("focus-visible:outline-none");
        });
    });

    describe("Data Validation Tests (Requirements 2.1, 2.2, 2.3, 2.4, 2.5)", () => {
        it("validates that product data is correctly saved with pending size status", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Click "Add colourway" to save with pending size
            const addColourwayButton = screen.getByText("Add colourway");
            await user.click(addColourwayButton);

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
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select a specific size
            const sizeSelect = screen.getByRole("combobox");
            await user.selectOptions(sizeSelect, "M");

            // Click "Add with M"
            const addWithSizeButton = screen.getByText("Add with M");
            await user.click(addWithSizeButton);

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
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            // Wait for colors to load
            await waitFor(() => {
                expect(screen.getByText("Red")).toBeInTheDocument();
            });

            // Select "All sizes"
            const sizeSelect = screen.getByRole("combobox");
            await user.selectOptions(sizeSelect, "__ALL_SIZES__");

            // Click "Add all sizes"
            const addWithSizeButton = screen.getByText("Add all sizes");
            await user.click(addWithSizeButton);

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

    describe("Visual Feedback Tests (Requirements 3.1, 3.2, 3.3, 3.4)", () => {
        it("shows proper visual feedback for button states", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

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
            await user.click(familyButton);

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
            await user.click(familyButton);

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
            await user.click(blueButton);

            // Check that selection feedback updates
            expect(screen.getByText("✓ Blue selected")).toBeInTheDocument();
        });

        it("shows size selection visual feedback", async () => {
            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

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
            await user.selectOptions(sizeSelect, "M");

            // Check that size selection feedback appears
            expect(screen.getByText("✓ M selected")).toBeInTheDocument();
            expect(screen.getByText("Only size M will be added to the shot")).toBeInTheDocument();

            // Select all sizes
            await user.selectOptions(sizeSelect, "__ALL_SIZES__");

            // Check all sizes feedback
            expect(screen.getByText("✓ All sizes selected")).toBeInTheDocument();
            expect(screen.getByText("All available sizes will be added to the shot")).toBeInTheDocument();
        });
    });

    describe("Responsive Behavior Tests (Requirement 1.4)", () => {
        it("works consistently across different viewport sizes", async () => {
            // Test mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375,
            });
            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: 667,
            });

            render(<ShotProductAddModal {...defaultProps} />);

            // Navigate to details view
            const familyButton = screen.getByText("Test Style");
            await user.click(familyButton);

            await waitFor(() => {
                expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
            });

            const dialog = screen.getByRole("dialog");
            const scrollContainer = within(dialog).getByTestId("shot-product-scroll-region");
            expect(scrollContainer).toHaveClass("overflow-y-auto");

            // Verify buttons are still accessible
            const addColourwayButton = within(dialog)
                .getByRole("button", { name: /add colourway/i });
            expect(addColourwayButton).toBeInTheDocument();
        });
    });
});
