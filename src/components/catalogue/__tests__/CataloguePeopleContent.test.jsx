import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CataloguePeopleContent from "../CataloguePeopleContent";

vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../talent/TalentDetailModal", () => ({
  default: () => null,
}));

import { useAuth } from "../../../context/AuthContext";

describe("CataloguePeopleContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ clientId: "client-1" });
  });

  it("invokes onEditPerson when the row pencil is clicked", () => {
    const onEditPerson = vi.fn();
    render(
      <CataloguePeopleContent
        people={[
          {
            id: "crew-1",
            type: "crew",
            firstName: "Ted",
            lastName: "Ghanime",
            avatar: "TG",
          },
        ]}
        selectedGroup="crew"
        onEditPerson={onEditPerson}
        canEditCrew={true}
        canEditTalent={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /edit person/i }));
    expect(onEditPerson).toHaveBeenCalledWith(
      expect.objectContaining({ id: "crew-1", type: "crew" })
    );
  });

  it("shows bulk actions when a row is selected", () => {
    render(
      <CataloguePeopleContent
        people={[
          {
            id: "crew-1",
            type: "crew",
            firstName: "Ted",
            lastName: "Ghanime",
            avatar: "TG",
          },
        ]}
        selectedGroup="crew"
        canEditCrew={true}
        canEditTalent={false}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions" })).toBeInTheDocument();
  });
});

