import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ShotTableView from "../ShotTableView.jsx";

globalThis.React = React;

describe("ShotTableView column ordering", () => {
  it("respects viewPrefs.fieldOrder and toggles including Tags", () => {
    const viewPrefs = {
      fieldOrder: [
        "name",
        "image",
        "status",
        "date",
        "type",
        "location",
        "products",
        "talent",
        "tags",
        "notes",
      ],
      showImage: true,
      showName: true,
      showType: true,
      showStatus: true,
      showDate: true,
      showLocation: true,
      showProducts: true,
      showTalent: true,
      showNotes: true,
      showTags: true,
    };

    render(
      <ShotTableView
        rows={[]}
        viewPrefs={viewPrefs}
        density={{ tableRow: "py-2", tablePadding: "px-2", tableText: "text-sm" }}
      />
    );

    const row = screen.getByRole("row");
    const headers = within(row).getAllByRole("columnheader").map((el) => el.textContent?.trim());
    expect(headers).toEqual([
      "Shot",
      "Image",
      "Status",
      "Date",
      "Location",
      "Products",
      "Talent",
      "Tags",
      "Notes",
    ]);
  });
});
