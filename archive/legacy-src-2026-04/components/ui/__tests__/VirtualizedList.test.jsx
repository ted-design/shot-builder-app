import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import VirtualizedList, { VirtualizedGrid } from "../VirtualizedList";

// Mock react-window components
vi.mock("react-window", () => ({
  List: ({ children, itemCount }) => (
    <div data-testid="react-window-list">
      {Array.from({ length: Math.min(itemCount, 10) }, (_, i) =>
        children({ index: i, style: {} })
      )}
    </div>
  ),
  Grid: ({ children, rowCount, columnCount }) => (
    <div data-testid="react-window-grid">
      {Array.from({ length: Math.min(rowCount, 3) }, (_, rowIndex) =>
        Array.from({ length: columnCount }, (_, columnIndex) =>
          children({ columnIndex, rowIndex, style: {} })
        )
      )}
    </div>
  ),
}));

describe("VirtualizedList", () => {
  const createItems = (count) =>
    Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, name: `Item ${i}` }));

  const mockRenderItem = vi.fn((item, index, isVirtualized) => (
    <div data-testid={`item-${item.id}`} data-virtualized={isVirtualized}>
      {item.name}
    </div>
  ));

  beforeEach(() => {
    mockRenderItem.mockClear();
  });

  describe("Threshold behavior", () => {
    it("renders non-virtualized for lists below threshold (100 items)", () => {
      const items = createItems(50);
      render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
          threshold={100}
        />
      );

      // Should render all items directly (not using react-window)
      expect(screen.queryByTestId("react-window-list")).not.toBeInTheDocument();
      expect(mockRenderItem).toHaveBeenCalledTimes(50);

      // Check isVirtualized flag is false
      expect(mockRenderItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-0" }),
        0,
        false
      );
    });

    it("renders virtualized for lists at or above threshold", () => {
      const items = createItems(150);
      render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
          threshold={100}
        />
      );

      // Should use react-window
      expect(screen.getByTestId("react-window-list")).toBeInTheDocument();

      // Check isVirtualized flag is true
      expect(mockRenderItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-0" }),
        0,
        true
      );
    });

    it("respects custom threshold", () => {
      const items = createItems(25);
      render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
          threshold={20}
        />
      );

      // Should be virtualized with lower threshold
      expect(screen.getByTestId("react-window-list")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("includes ARIA attributes for list role", () => {
      const items = createItems(150);
      const { container } = render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
        />
      );

      const listContainer = container.querySelector('[role="list"]');
      expect(listContainer).toBeInTheDocument();
      expect(listContainer).toHaveAttribute("aria-rowcount", "150");
    });

    it("includes ARIA attributes for listitem roles", () => {
      const items = createItems(150);
      render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
        />
      );

      const firstListItem = screen.getByTestId("react-window-list").querySelector('[role="listitem"]');
      expect(firstListItem).toHaveAttribute("aria-setsize", "150");
      expect(firstListItem).toHaveAttribute("aria-posinset", "1");
    });
  });

  describe("Edge cases", () => {
    it("handles empty array", () => {
      render(
        <VirtualizedList
          items={[]}
          renderItem={mockRenderItem}
          itemHeight={100}
        />
      );

      expect(mockRenderItem).not.toHaveBeenCalled();
    });

    it("handles single item", () => {
      const items = createItems(1);
      render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
        />
      );

      expect(mockRenderItem).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Item 0")).toBeInTheDocument();
    });

    it("uses item.id for key when available", () => {
      const items = createItems(10);
      const { container } = render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
        />
      );

      const firstItem = container.querySelector('[data-testid="item-item-0"]');
      expect(firstItem).toBeInTheDocument();
    });

    it("falls back to index for key when id not available", () => {
      const items = [{ name: "No ID" }];
      const { container } = render(
        <VirtualizedList
          items={items}
          renderItem={(item) => <div>{item.name}</div>}
          itemHeight={100}
        />
      );

      expect(screen.getByText("No ID")).toBeInTheDocument();
    });
  });

  describe("Props", () => {
    it("applies custom className", () => {
      const items = createItems(5);
      const { container } = render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });

    it("uses custom width", () => {
      const items = createItems(150);
      render(
        <VirtualizedList
          items={items}
          renderItem={mockRenderItem}
          itemHeight={100}
          width={500}
        />
      );

      expect(screen.getByTestId("react-window-list")).toBeInTheDocument();
    });
  });
});

describe("VirtualizedGrid", () => {
  const createItems = (count) =>
    Array.from({ length: count }, (_, i) => ({ id: `item-${i}`, name: `Item ${i}` }));

  const mockRenderItem = vi.fn((item, index, isVirtualized) => (
    <div data-testid={`item-${item.id}`} data-virtualized={isVirtualized}>
      {item.name}
    </div>
  ));

  // Mock window.innerWidth for responsive column tests
  let originalInnerWidth;
  beforeEach(() => {
    mockRenderItem.mockClear();
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  describe("Threshold behavior", () => {
    it("renders non-virtualized for grids below threshold", () => {
      const items = createItems(50);
      render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
          threshold={100}
        />
      );

      expect(screen.queryByTestId("react-window-grid")).not.toBeInTheDocument();
      expect(mockRenderItem).toHaveBeenCalledTimes(50);

      // Check isVirtualized flag
      expect(mockRenderItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-0" }),
        0,
        false
      );
    });

    it("renders virtualized for grids at or above threshold", () => {
      const items = createItems(150);
      render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
          threshold={100}
        />
      );

      expect(screen.getByTestId("react-window-grid")).toBeInTheDocument();

      // Check isVirtualized flag
      expect(mockRenderItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "item-0" }),
        0,
        true
      );
    });
  });

  describe("Responsive columns", () => {
    it("uses 1 column on mobile (< 640px)", () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      const items = createItems(150);
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toHaveAttribute("aria-colcount", "1");
    });

    it("uses 2 columns on tablet (640px - 1279px)", () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const items = createItems(150);
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toHaveAttribute("aria-colcount", "2");
    });

    it("uses 3 columns on desktop (>= 1280px)", () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1400,
      });

      const items = createItems(150);
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toHaveAttribute("aria-colcount", "3");
    });
  });

  describe("Custom column breakpoints", () => {
    it("respects custom columnBreakpoints with all breakpoints", () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1600, // 2xl breakpoint
      });

      const items = createItems(150);
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
          columnBreakpoints={{ default: 1, sm: 2, md: 2, lg: 3, xl: 4, '2xl': 5 }}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toHaveAttribute("aria-colcount", "5");
    });

    it("uses xl breakpoint value for xl viewport width", () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1300, // xl breakpoint (1280px+)
      });

      const items = createItems(150);
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
          columnBreakpoints={{ default: 1, sm: 2, lg: 3, xl: 4 }}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toHaveAttribute("aria-colcount", "4");
    });

    it("falls back to sm value when md is not provided", () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800, // md breakpoint (768px+)
      });

      const items = createItems(150);
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
          columnBreakpoints={{ default: 1, sm: 2, lg: 3 }}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      // Should use sm value since md is not defined
      expect(gridContainer).toHaveAttribute("aria-colcount", "2");
    });

    it("uses default value for mobile when no sm breakpoint", () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500, // mobile
      });

      const items = createItems(150);
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
          columnBreakpoints={{ default: 1, lg: 3, xl: 4 }}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toHaveAttribute("aria-colcount", "1");
    });
  });

  describe("Accessibility", () => {
    it("includes ARIA attributes for grid role", () => {
      const items = createItems(150);
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer).toHaveAttribute("aria-rowcount");
      expect(gridContainer).toHaveAttribute("aria-colcount");
    });

    it("includes ARIA attributes for gridcell roles", () => {
      const items = createItems(150);
      render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
        />
      );

      const gridCell = screen.getByTestId("react-window-grid").querySelector('[role="gridcell"]');
      expect(gridCell).toHaveAttribute("aria-colindex", "1");
    });
  });

  describe("Edge cases", () => {
    it("handles empty array", () => {
      render(
        <VirtualizedGrid
          items={[]}
          renderItem={mockRenderItem}
          itemHeight={200}
        />
      );

      expect(mockRenderItem).not.toHaveBeenCalled();
    });

    it("handles partial last row", () => {
      const items = createItems(5); // With 3 columns, this creates 2 rows (3 + 2)
      render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
        />
      );

      expect(mockRenderItem).toHaveBeenCalledTimes(5);
    });
  });

  describe("Grid calculations", () => {
    it("calculates row count correctly", () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1400, // 3 columns
      });

      const items = createItems(150); // 150 items / 3 columns = 50 rows
      const { container } = render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
        />
      );

      const gridContainer = container.querySelector('[role="grid"]');
      expect(gridContainer).toHaveAttribute("aria-rowcount", "50");
    });

    it("includes gap in height calculations", () => {
      const items = createItems(150);
      render(
        <VirtualizedGrid
          items={items}
          renderItem={mockRenderItem}
          itemHeight={200}
          gap={20}
        />
      );

      // Just verify it renders without error
      expect(screen.getByTestId("react-window-grid")).toBeInTheDocument();
    });
  });
});
