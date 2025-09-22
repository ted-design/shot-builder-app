import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
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

describe("ShotProductAddModal - Enhanced Button State Logic", () => {
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

        // Select a colourway
        const redColorButton = screen.getByText("Red");
        fireEvent.click(redColorButton);

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

        // Click "Add with M"
        const addWithSizeButton = screen.getByText("Add with M");
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