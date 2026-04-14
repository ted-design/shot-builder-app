import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ColorTagPicker from "../ColorTagPicker";
import { COLOR_TAGS } from "../../../../types/schedule";

describe("ColorTagPicker", () => {
  it("renders all color buttons plus clear button", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value={null} onChange={onChange} />);

    // 8 color buttons + 1 clear button = 9 buttons
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(9);
  });

  it("renders clear button with correct title", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value={null} onChange={onChange} />);

    const clearButton = screen.getByTitle("No color");
    expect(clearButton).toBeInTheDocument();
  });

  it("renders all color tags with correct titles", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value={null} onChange={onChange} />);

    COLOR_TAGS.forEach((color) => {
      const button = screen.getByTitle(color.label);
      expect(button).toBeInTheDocument();
    });
  });

  it("calls onChange with color id when color button clicked", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value={null} onChange={onChange} />);

    const redButton = screen.getByTitle("Red");
    fireEvent.click(redButton);

    expect(onChange).toHaveBeenCalledWith("red");
  });

  it("calls onChange with null when clear button clicked", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value="red" onChange={onChange} />);

    const clearButton = screen.getByTitle("No color");
    fireEvent.click(clearButton);

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("applies visual indication to selected color", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value="blue" onChange={onChange} />);

    const blueButton = screen.getByTitle("Blue");
    // Selected buttons have scale-110 class
    expect(blueButton).toHaveClass("scale-110");
  });

  it("applies visual indication when no color selected", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value={null} onChange={onChange} />);

    const clearButton = screen.getByTitle("No color");
    // Clear button shows ring when selected
    expect(clearButton).toHaveClass("ring-2");
  });

  it("applies custom className to container", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColorTagPicker value={null} onChange={onChange} className="custom-class" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("custom-class");
  });

  it("buttons have type=button to prevent form submission", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value={null} onChange={onChange} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("type", "button");
    });
  });

  it("applies correct background color to color buttons", () => {
    const onChange = vi.fn();
    render(<ColorTagPicker value={null} onChange={onChange} />);

    // Check that red button has the correct hex color
    const redButton = screen.getByTitle("Red");
    const redTag = COLOR_TAGS.find((c) => c.id === "red");
    expect(redButton).toHaveStyle({ backgroundColor: redTag.value });
  });

  it("handles switching between colors", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ColorTagPicker value="red" onChange={onChange} />
    );

    let redButton = screen.getByTitle("Red");
    expect(redButton).toHaveClass("scale-110");

    // Click blue
    const blueButton = screen.getByTitle("Blue");
    fireEvent.click(blueButton);
    expect(onChange).toHaveBeenCalledWith("blue");

    // Rerender with new value
    rerender(<ColorTagPicker value="blue" onChange={onChange} />);

    // Now blue should be selected
    expect(screen.getByTitle("Blue")).toHaveClass("scale-110");
    // Red should not be selected
    redButton = screen.getByTitle("Red");
    expect(redButton).not.toHaveClass("scale-110");
  });
});
