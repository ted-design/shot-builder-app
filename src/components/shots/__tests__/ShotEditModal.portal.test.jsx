import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ShotEditModal from "../ShotEditModal";

// Mock the hooks used by NotesEditor
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../hooks/useComments", () => ({
  useUsers: vi.fn(),
}));

import { useAuth } from "../../../context/AuthContext";
import { useUsers } from "../../../hooks/useComments";

const baseDraft = {
  name: "Shot A",
  description: "",
  type: "",
  status: "todo",
  date: "",
  locationId: "",
  products: [],
  talent: [],
};

const noop = () => {};

describe("ShotEditModal talent select", () => {
  beforeEach(() => {
    if (!global.requestAnimationFrame) {
      global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    }

    // Mock AuthContext
    useAuth.mockReturnValue({
      user: { uid: "test-user" },
      clientId: "test-client",
    });

    // Mock useUsers hook
    useUsers.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it("renders the talent menu in a body portal with high z-index", async () => {
    render(
      <ShotEditModal
        open
        draft={baseDraft}
        shotName="Shot A"
        onChange={noop}
        onClose={noop}
        onSubmit={noop}
        families={[]}
        locations={[]}
        talentOptions={[{ talentId: "tal-1", name: "Jane Doe" }]}
      />
    );

    const comboboxes = await screen.findAllByRole("combobox");
    const talentCombobox = comboboxes.find((element) => element.id?.startsWith("react-select"));
    expect(talentCombobox).toBeTruthy();
    fireEvent.keyDown(talentCombobox, { key: "ArrowDown" });

    const menu = await waitFor(() => document.body.querySelector(".talent-select__menu"));
    expect(menu).toBeTruthy();

    const portalContainer = menu?.parentElement;
    expect(portalContainer?.parentElement).toBe(document.body);
    const computedZ = portalContainer ? window.getComputedStyle(portalContainer).zIndex : "";
    expect(computedZ).toBe("1200");
  });
});
