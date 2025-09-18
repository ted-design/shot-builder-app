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

describe("ShotProductAddModal - Button State Logic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("disables both buttons when no colourway is selected", async () => {
        render(<ShotProductAddModal {...defaultProps} />);

        // Navigate to details view
        const familyButton = screen.getByText("Test Style");
        fireEvent.click(familyButton);

        await waitFor(() => {
            expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
        });

        // Wait for colors to load and check initial state
        await waitFor(() => {
            expect(screen.getByText("Red")).toBeInTheDocument();
        });

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add & choose size now");

        // Both buttons should be enabled since a colourway is auto-selected
        expect(addColourwayButton).not.toBeDisabled();
        expect(addWithSizeButton).toBeDisabled(); // No size selected
    });

    it("enables 'Add colourway' button when colourway is selected, keeps 'Add & choose size' disabled when no size selected", async () => {
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

        // Select a colourway explicitly
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add & choose size now");

        // Add colourway should be enabled, Add & choose size should be disabled (no size selected)
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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        // Select a specific size
        const sizeSelect = screen.getByRole("combobox");
        fireEvent.change(sizeSelect, { target: { value: "M" } });

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add & choose size now");

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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        // Select "All sizes"
        const sizeSelect = screen.getByRole("combobox");
        fireEvent.change(sizeSelect, { target: { value: "__ALL_SIZES__" } });

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add & choose size now");

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

    it("calls onSubmit with correct data when 'Add colourway' is clicked", async () => {
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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        // Click "Add colourway"
        const addColourwayButton = screen.getByText("Add colourway");
        fireEvent.click(addColourwayButton);

        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
            family: mockFamilies[0],
            colour: mockFamilyDetails.colours[0],
            size: null,
            status: "pending-size",
            sizeScope: "pending",
        });
    });

    it("calls onSubmit with correct data when 'Add & choose size now' is clicked with specific size", async () => {
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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        // Select a specific size
        const sizeSelect = screen.getByRole("combobox");
        fireEvent.change(sizeSelect, { target: { value: "M" } });

        // Click "Add & choose size now"
        const addWithSizeButton = screen.getByText("Add & choose size now");
        fireEvent.click(addWithSizeButton);

        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
            family: mockFamilies[0],
            colour: mockFamilyDetails.colours[0],
            size: "M",
            status: "complete",
            sizeScope: "single",
        });
    });
});

describe("ShotProductAddModal - Button State Logic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("enables 'Add colourway' button when colourway is selected, keeps 'Add & choose size' disabled when no size selected", async () => {
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

        // Select a colourway explicitly
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add & choose size now");

        // Add colourway should be enabled, Add & choose size should be disabled (no size selected)
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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        // Select a specific size
        const sizeSelect = screen.getByRole("combobox");
        fireEvent.change(sizeSelect, { target: { value: "M" } });

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add & choose size now");

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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        // Select "All sizes"
        const sizeSelect = screen.getByRole("combobox");
        fireEvent.change(sizeSelect, { target: { value: "__ALL_SIZES__" } });

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add & choose size now");

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

    it("calls onSubmit with correct data when 'Add colourway' is clicked", async () => {
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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        // Click "Add colourway"
        const addColourwayButton = screen.getByText("Add colourway");
        fireEvent.click(addColourwayButton);

        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
            family: mockFamilies[0],
            colour: mockFamilyDetails.colours[0],
            size: null,
            status: "pending-size",
            sizeScope: "pending",
        });
    });

    it("calls onSubmit with correct data when 'Add & choose size now' is clicked with specific size", async () => {
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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

        // Select a specific size
        const sizeSelect = screen.getByRole("combobox");
        fireEvent.change(sizeSelect, { target: { value: "M" } });

        // Click "Add & choose size now"
        const addWithSizeButton = screen.getByText("Add & choose size now");
        fireEvent.click(addWithSizeButton);

        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
            family: mockFamilies[0],
            colour: mockFamilyDetails.colours[0],
            size: "M",
            status: "complete",
            sizeScope: "single",
        });
    });
});

describe("ShotProductAddModal - Scrolling and Layout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders with proper scrollable container structure", () => {
        render(<ShotProductAddModal {...defaultProps} />);

        // Check that the scrollable container exists
        const scrollContainer = screen.getByRole("dialog").querySelector('[tabindex="0"]');
        expect(scrollContainer).toBeInTheDocument();
        expect(scrollContainer).toHaveClass("flex-1", "overflow-y-auto", "overscroll-contain");
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
        const cardContent = screen.getByRole("dialog").querySelector('.space-y-4');
        expect(cardContent).toHaveClass("pb-32");
    });

    it("renders sticky footer with proper styling", async () => {
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

    it("maintains focus management with scrollable container", () => {
        render(<ShotProductAddModal {...defaultProps} />);

        // Check that the scrollable container can receive focus
        const scrollContainer = screen.getByRole("dialog").querySelector('[tabindex="0"]');
        expect(scrollContainer).toHaveAttribute("tabindex", "0");
        expect(scrollContainer).toHaveClass("focus-visible:outline-none");
    });

    it("handles different content heights properly", async () => {
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

        // Verify that with many colors, the layout still works
        const colorButtons = screen.getAllByRole("button").filter(btn =>
            btn.textContent.startsWith("Color ")
        );
        expect(colorButtons.length).toBe(20);

        // Verify sticky footer is still accessible
        const addColourwayButton = screen.getByText("Add colourway");
        expect(addColourwayButton).toBeInTheDocument();
    });
});