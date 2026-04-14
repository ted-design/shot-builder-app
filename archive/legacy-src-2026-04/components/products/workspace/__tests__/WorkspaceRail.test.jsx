import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WorkspaceRail, { NavRailItem } from "../WorkspaceRail";
import { WORKSPACE_SECTIONS } from "../WorkspaceContext";

describe("WorkspaceRail", () => {
  const defaultProps = {
    activeSection: "overview",
    onSectionChange: vi.fn(),
    counts: {
      colorways: 8,
      samples: 5,
      assets: 0,
      activity: 0,
    },
  };

  it("renders all workspace sections", () => {
    render(<WorkspaceRail {...defaultProps} />);

    WORKSPACE_SECTIONS.forEach((section) => {
      expect(screen.getByRole("button", { name: section.label })).toBeInTheDocument();
    });
  });

  it("marks active section with aria-current", () => {
    render(<WorkspaceRail {...defaultProps} activeSection="colorways" />);

    const colorwaysButton = screen.getByRole("button", { name: "Colorways" });
    expect(colorwaysButton).toHaveAttribute("aria-current", "page");

    const overviewButton = screen.getByRole("button", { name: "Overview" });
    expect(overviewButton).not.toHaveAttribute("aria-current");
  });

  it("calls onSectionChange when section is clicked", () => {
    const onSectionChange = vi.fn();
    render(<WorkspaceRail {...defaultProps} onSectionChange={onSectionChange} />);

    const samplesButton = screen.getByRole("button", { name: "Samples" });
    fireEvent.click(samplesButton);

    expect(onSectionChange).toHaveBeenCalledWith("samples");
  });

  it("has navigation role with proper label", () => {
    render(<WorkspaceRail {...defaultProps} />);

    const nav = screen.getByRole("navigation", { name: "Workspace sections" });
    expect(nav).toBeInTheDocument();
  });

  it("expands on mouse enter", () => {
    const { container } = render(<WorkspaceRail {...defaultProps} />);

    const nav = container.querySelector("nav");
    expect(nav.className).toContain("w-14"); // Initially collapsed

    fireEvent.mouseEnter(nav);

    expect(nav.className).toContain("w-48"); // Expanded
  });

  it("collapses on mouse leave", () => {
    const { container } = render(<WorkspaceRail {...defaultProps} />);

    const nav = container.querySelector("nav");

    // Expand first
    fireEvent.mouseEnter(nav);
    expect(nav.className).toContain("w-48");

    // Then collapse
    fireEvent.mouseLeave(nav);
    expect(nav.className).toContain("w-14");
  });
});

describe("NavRailItem", () => {
  const defaultSection = WORKSPACE_SECTIONS.find((s) => s.id === "colorways");

  it("renders section label when expanded", () => {
    render(
      <NavRailItem
        section={defaultSection}
        isActive={false}
        onClick={vi.fn()}
        count={8}
        isExpanded={true}
      />
    );

    expect(screen.getByText("Colorways")).toBeInTheDocument();
  });

  it("shows tooltip when collapsed", () => {
    render(
      <NavRailItem
        section={defaultSection}
        isActive={false}
        onClick={vi.fn()}
        count={8}
        isExpanded={false}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "Colorways (8)");
  });

  it("does not show tooltip when expanded", () => {
    render(
      <NavRailItem
        section={defaultSection}
        isActive={false}
        onClick={vi.fn()}
        count={8}
        isExpanded={true}
      />
    );

    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("title");
  });

  it("shows count badge when expanded", () => {
    render(
      <NavRailItem
        section={defaultSection}
        isActive={false}
        onClick={vi.fn()}
        count={8}
        isExpanded={true}
      />
    );

    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("does not show count badge for zero count when expanded", () => {
    render(
      <NavRailItem
        section={defaultSection}
        isActive={false}
        onClick={vi.fn()}
        count={0}
        isExpanded={true}
      />
    );

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <NavRailItem
        section={defaultSection}
        isActive={false}
        onClick={onClick}
        count={8}
        isExpanded={true}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("has aria-current when active", () => {
    render(
      <NavRailItem
        section={defaultSection}
        isActive={true}
        onClick={vi.fn()}
        count={8}
        isExpanded={true}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-current", "page");
  });

  it("has aria-label for accessibility", () => {
    render(
      <NavRailItem
        section={defaultSection}
        isActive={false}
        onClick={vi.fn()}
        count={8}
        isExpanded={false}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Colorways");
  });
});
