import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BentoCard, { SubMetricPill } from "../BentoCard";
import { Palette } from "lucide-react";

describe("BentoCard", () => {
  const defaultProps = {
    icon: Palette,
    title: "Colorways",
    description: "Manage color variants for this product.",
    onClick: vi.fn(),
  };

  it("renders title and description", () => {
    render(<BentoCard {...defaultProps} />);

    expect(screen.getByText("Colorways")).toBeInTheDocument();
    expect(screen.getByText("Manage color variants for this product.")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<BentoCard {...defaultProps} onClick={onClick} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders metric and metricLabel when provided", () => {
    render(
      <BentoCard
        {...defaultProps}
        metric={8}
        metricLabel="colorways"
      />
    );

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("colorways")).toBeInTheDocument();
  });

  it("renders subMetrics when provided", () => {
    const subMetrics = [
      { value: 3, label: "with photos", variant: "success" },
      { value: 2, label: "unique", variant: "default" },
    ];

    render(
      <BentoCard
        {...defaultProps}
        metric={5}
        metricLabel="total"
        subMetrics={subMetrics}
      />
    );

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("with photos")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("unique")).toBeInTheDocument();
  });

  it("does not render metric area when metric is undefined", () => {
    render(<BentoCard {...defaultProps} />);

    // Check that metric-specific elements aren't present
    expect(screen.queryByText("total")).not.toBeInTheDocument();
  });

  describe("coming-soon variant", () => {
    it("renders Coming soon badge", () => {
      render(<BentoCard {...defaultProps} variant="coming-soon" />);

      expect(screen.getByText("Coming soon")).toBeInTheDocument();
    });

    it("is disabled", () => {
      render(<BentoCard {...defaultProps} variant="coming-soon" />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("does not call onClick when clicked", () => {
      const onClick = vi.fn();
      render(<BentoCard {...defaultProps} variant="coming-soon" onClick={onClick} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });

    it("does not render metric area even when metric is provided", () => {
      render(
        <BentoCard
          {...defaultProps}
          variant="coming-soon"
          metric={5}
          metricLabel="items"
        />
      );

      // The metric should not be shown for coming-soon variant
      expect(screen.queryByText("5")).not.toBeInTheDocument();
      expect(screen.queryByText("items")).not.toBeInTheDocument();
    });
  });

  it("renders icon", () => {
    render(<BentoCard {...defaultProps} />);

    // The Palette icon should be rendered (checking via its container)
    const button = screen.getByRole("button");
    expect(button.querySelector("svg")).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(<BentoCard {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
  });
});

describe("SubMetricPill", () => {
  it("renders value and label", () => {
    render(<SubMetricPill value={3} label="arrived" variant="success" />);

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("arrived")).toBeInTheDocument();
  });

  it("applies success variant styling", () => {
    const { container } = render(
      <SubMetricPill value={3} label="arrived" variant="success" />
    );

    const pill = container.querySelector("span");
    expect(pill.className).toContain("bg-emerald");
  });

  it("applies danger variant styling", () => {
    const { container } = render(
      <SubMetricPill value={1} label="issues" variant="danger" />
    );

    const pill = container.querySelector("span");
    expect(pill.className).toContain("bg-rose");
  });

  it("applies warning variant styling", () => {
    const { container } = render(
      <SubMetricPill value={2} label="requested" variant="warning" />
    );

    const pill = container.querySelector("span");
    expect(pill.className).toContain("bg-amber");
  });

  it("applies info variant styling", () => {
    const { container } = render(
      <SubMetricPill value={4} label="in transit" variant="info" />
    );

    const pill = container.querySelector("span");
    expect(pill.className).toContain("bg-sky");
  });

  it("applies default variant styling when no variant specified", () => {
    const { container } = render(
      <SubMetricPill value={2} label="unique" />
    );

    const pill = container.querySelector("span");
    expect(pill.className).toContain("bg-slate");
  });

  it("falls back to default variant for unknown variant", () => {
    const { container } = render(
      <SubMetricPill value={2} label="unknown" variant="nonexistent" />
    );

    const pill = container.querySelector("span");
    expect(pill.className).toContain("bg-slate");
  });
});
