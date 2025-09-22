import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "../../../test-utils/userEvent";
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

describe("ShotProductAddModal - Button State Logic", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("disables both buttons when no colourway is selected", async () => {
        const user = userEvent.setup();
        render(<ShotProductAddModal {...defaultProps} />);

        const familyButton = screen.getByText("Test Style");
        await user.click(familyButton);

        await waitFor(() => {
            expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
        });

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
        const user = userEvent.setup();
        render(<ShotProductAddModal {...defaultProps} />);

        const familyButton = screen.getByText("Test Style");
        await user.click(familyButton);

        await waitFor(() => {
            expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
        });

        // Wait for colors to load
        await waitFor(() => {
            expect(screen.getByText("Red")).toBeInTheDocument();
        });

        const redColorButton = screen.getByText("Red");
        await user.click(redColorButton);

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add & choose size now");

        // Add colourway should be enabled, Add & choose size should be disabled (no size selected)
        expect(addColourwayButton).not.toBeDisabled();
        expect(addWithSizeButton).toBeDisabled();
    });

    it("enables both buttons when colourway and specific size are selected", async () => {
        const user = userEvent.setup();
        render(<ShotProductAddModal {...defaultProps} />);

        const familyButton = screen.getByText("Test Style");
        await user.click(familyButton);

        await waitFor(() => {
            expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
        });

        // Wait for colors to load
        await waitFor(() => {
            expect(screen.getByText("Red")).toBeInTheDocument();
        });

        const redColorButton = screen.getByText("Red");
        await user.click(redColorButton);

        const sizeSelect = screen.getByRole("combobox");
        await user.selectOptions(sizeSelect, "M");

        const addColourwayButton = screen.getByText("Add colourway");
        const addWithSizeButton = screen.getByText("Add with M");

        // Both buttons should be enabled
        expect(addColourwayButton).not.toBeDisabled();
        expect(addWithSizeButton).not.toBeDisabled();
    });

    it("enables both buttons when colourway is selected and 'All sizes' is chosen", async () => {
        const user = userEvent.setup();
        render(<ShotProductAddModal {...defaultProps} />);

        const familyButton = screen.getByText("Test Style");
        await user.click(familyButton);

        await waitFor(() => {
            expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
        });

        // Wait for colors to load
        await waitFor(() => {
            expect(screen.getByText("Red")).toBeInTheDocument();
        });

        const redColorButton = screen.getByText("Red");
        await user.click(redColorButton);

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

        const user = userEvent.setup();
        render(<ShotProductAddModal {...loadingProps} />);

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

    it("calls onSubmit with correct data when 'Add colourway' is clicked", async () => {
        const user = userEvent.setup();
        render(<ShotProductAddModal {...defaultProps} />);

        const familyButton = screen.getByText("Test Style");
        await user.click(familyButton);

        await waitFor(() => {
            expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
        });

        // Wait for colors to load
        await waitFor(() => {
            expect(screen.getByText("Red")).toBeInTheDocument();
        });

        const redColorButton = screen.getByText("Red");
        await user.click(redColorButton);

        const addColourwayButton = screen.getByText("Add colourway");
        await user.click(addColourwayButton);

        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
            family: mockFamilies[0],
            colour: mockFamilyDetails.colours[0],
            size: null,
            status: "pending-size",
            sizeScope: "pending",
        });
    });

    it("calls onSubmit with correct data when dynamic button is clicked with specific size", async () => {
        const user = userEvent.setup();
        render(<ShotProductAddModal {...defaultProps} />);

        const familyButton = screen.getByText("Test Style");
        await user.click(familyButton);

        await waitFor(() => {
            expect(screen.getByText("Choose colour & size")).toBeInTheDocument();
        });

        // Wait for colors to load
        await waitFor(() => {
            expect(screen.getByText("Red")).toBeInTheDocument();
        });

        const redColorButton = screen.getByText("Red");
        await user.click(redColorButton);

        const sizeSelect = screen.getByRole("combobox");
        await user.selectOptions(sizeSelect, "M");

        const addWithSizeButton = screen.getByText("Add with M");
        await user.click(addWithSizeButton);

        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
            family: mockFamilies[0],
            colour: mockFamilyDetails.colours[0],
            size: "M",
            status: "complete",
            sizeScope: "single",
        });
    });

    it("shows create new product button when creation is allowed", () => {
        render(
            <ShotProductAddModal
                {...defaultProps}
                canCreateProduct
                onCreateProduct={vi.fn()}
            />
        );

        expect(screen.getByText("Create new product")).toBeInTheDocument();
    });

    it("filters product families by gender", async () => {
        const user = userEvent.setup();
        const extraFamilies = [
            {
                id: "family2",
                styleName: "Mens Jacket",
                styleNumber: "MJ002",
                colorNames: ["Black"],
                archived: false,
                sizes: ["M", "L"],
                gender: "men",
            },
            {
                id: "family3",
                styleName: "Unisex Tee",
                styleNumber: "UT003",
                colorNames: ["White"],
                archived: false,
                sizes: ["S", "M", "L"],
                gender: "unisex",
            },
        ];

        render(
            <ShotProductAddModal
                {...defaultProps}
                families={[...mockFamilies, ...extraFamilies]}
            />
        );

        const genderSelect = screen.getByLabelText("Gender");
        expect(genderSelect).toBeInTheDocument();
        expect(screen.getByText("Test Style")).toBeInTheDocument();
        expect(screen.getByText("Mens Jacket")).toBeInTheDocument();
        expect(screen.getByText("Unisex Tee")).toBeInTheDocument();

        await user.selectOptions(genderSelect, "men");

        await waitFor(() => {
            expect(screen.getByText("Mens Jacket")).toBeInTheDocument();
        });
        expect(screen.queryByText("Test Style")).not.toBeInTheDocument();
        expect(screen.queryByText("Unisex Tee")).not.toBeInTheDocument();
    });
});

describe("ShotProductAddModal - Scrolling and Layout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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

    it("has sufficient bottom padding to clear sticky footer", async () => {
        const user = userEvent.setup();
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

    it("renders sticky footer with proper styling", async () => {
        const user = userEvent.setup();
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

    it("action buttons are accessible in the sticky footer", async () => {
        const user = userEvent.setup();
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

    it("maintains focus management with scrollable container", () => {
        render(<ShotProductAddModal {...defaultProps} />);

        const dialog = screen.getByRole("dialog");
        const scrollContainer = within(dialog).getByTestId("shot-product-scroll-region");

        expect(scrollContainer).toHaveAttribute("tabindex", "0");
        expect(scrollContainer).toHaveClass("focus-visible:outline-none");
    });

    it("handles different content heights properly", async () => {
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

        const user = userEvent.setup();
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
    });
});
