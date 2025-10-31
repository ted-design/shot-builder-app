import React, { useMemo, useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShotsOverviewProvider, useShotsOverview } from "../../context/ShotsOverviewContext.jsx";

const defaultFilters = {
  locationId: "",
  talentIds: [],
  productFamilyIds: [],
  tagIds: [],
  showArchived: false,
};

function ShotsConsumer() {
  const overview = useShotsOverview();
  return (
    <div>
      <button
        type="button"
        onClick={() => overview.setFilters((prev) => ({ ...prev, locationId: "loc-1" }))}
      >
        Set Location
      </button>
      <button
        type="button"
        onClick={() => overview.setSelectedShotIds(new Set(["shot-1"]))}
      >
        Select Shot 1
      </button>
      <button
        type="button"
        onClick={() =>
          overview.setSelectedShotIds((prev) => {
            const next = new Set(prev);
            next.add("shot-3");
            return next;
          })
        }
      >
        Append Shot 3
      </button>
      <button type="button" onClick={() => overview.setFocusShotId("shot-2")}>
        Focus Shot 2
      </button>
      <button type="button" onClick={() => overview.setFocusShotId(null)}>
        Clear Focus
      </button>
    </div>
  );
}

function PlannerConsumer() {
  const overview = useShotsOverview();
  const selectionSize = overview.selectedShotIds instanceof Set ? overview.selectedShotIds.size : 0;
  return (
    <section>
      <p data-testid="location-filter">{overview.filters.locationId || "none"}</p>
      <p data-testid="selection-size">{selectionSize}</p>
      <p data-testid="focus-shot">{overview.focusShotId || "none"}</p>
    </section>
  );
}

function Harness() {
  const [filters, setFilters] = useState(defaultFilters);
  const [selectedShotIds, setSelectedShotIds] = useState(new Set());
  const [focusShotId, setFocusShotId] = useState(null);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      selectedShotIds,
      setSelectedShotIds,
      focusShotId,
      setFocusShotId,
    }),
    [filters, selectedShotIds, focusShotId]
  );

  return (
    <ShotsOverviewProvider value={value}>
      <ShotsConsumer />
      <PlannerConsumer />
    </ShotsOverviewProvider>
  );
}

describe("ShotsOverviewContext", () => {
  it("shares filters, selections, and focus across consumers", () => {
    render(<Harness />);

    expect(screen.getByTestId("location-filter").textContent).toBe("none");
    expect(screen.getByTestId("selection-size").textContent).toBe("0");
    expect(screen.getByTestId("focus-shot").textContent).toBe("none");

    fireEvent.click(screen.getByText("Set Location"));
    expect(screen.getByTestId("location-filter").textContent).toBe("loc-1");

    fireEvent.click(screen.getByText("Select Shot 1"));
    expect(screen.getByTestId("selection-size").textContent).toBe("1");

    fireEvent.click(screen.getByText("Append Shot 3"));
    expect(screen.getByTestId("selection-size").textContent).toBe("2");

    fireEvent.click(screen.getByText("Focus Shot 2"));
    expect(screen.getByTestId("focus-shot").textContent).toBe("shot-2");

    fireEvent.click(screen.getByText("Clear Focus"));
    expect(screen.getByTestId("focus-shot").textContent).toBe("none");
  });
});
