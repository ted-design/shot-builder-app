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

// Mock useAvailableTags hook to prevent TanStack Query requirement
vi.mock("../../../hooks/useAvailableTags", () => ({
  useAvailableTags: vi.fn(),
}));

// Mock reactjs-tiptap-editor and Mention extension
vi.mock("reactjs-tiptap-editor", () => ({
  default: ({ content, onChangeContent, disabled, placeholder }) => (
    <div data-testid="tiptap-editor">
      <textarea
        value={content || ""}
        onChange={(e) => onChangeContent?.(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  ),
  BaseKit: {
    configure: (config) => ({
      type: "BaseKit",
      config,
    }),
  },
}));

vi.mock("reactjs-tiptap-editor/mention", () => ({
  Mention: {
    configure: (config) => ({
      type: "Mention",
      config,
    }),
  },
}));

// Mock all formatting extensions
vi.mock("reactjs-tiptap-editor/bold", () => ({ Bold: { type: "Bold" } }));
vi.mock("reactjs-tiptap-editor/italic", () => ({ Italic: { type: "Italic" } }));
vi.mock("reactjs-tiptap-editor/textunderline", () => ({ TextUnderline: { type: "TextUnderline" } }));
vi.mock("reactjs-tiptap-editor/strike", () => ({ Strike: { type: "Strike" } }));
vi.mock("reactjs-tiptap-editor/code", () => ({ Code: { type: "Code" } }));
vi.mock("reactjs-tiptap-editor/heading", () => ({ Heading: { type: "Heading" } }));
vi.mock("reactjs-tiptap-editor/bulletlist", () => ({ BulletList: { type: "BulletList" } }));
vi.mock("reactjs-tiptap-editor/orderedlist", () => ({ OrderedList: { type: "OrderedList" } }));
vi.mock("reactjs-tiptap-editor/listitem", () => ({ ListItem: { type: "ListItem" } }));
vi.mock("reactjs-tiptap-editor/blockquote", () => ({ Blockquote: { type: "Blockquote" } }));
vi.mock("reactjs-tiptap-editor/color", () => ({ Color: { type: "Color" } }));
vi.mock("reactjs-tiptap-editor/codeblock", () => ({ CodeBlock: { type: "CodeBlock" } }));
vi.mock("reactjs-tiptap-editor/link", () => ({ Link: { type: "Link" } }));
vi.mock("reactjs-tiptap-editor/horizontalrule", () => ({ HorizontalRule: { type: "HorizontalRule" } }));
vi.mock("reactjs-tiptap-editor/history", () => ({ History: { type: "History" } }));

import { useAuth } from "../../../context/AuthContext";
import { useUsers } from "../../../hooks/useComments";
import { useAvailableTags } from "../../../hooks/useAvailableTags";

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

    // Mock useAvailableTags hook
    useAvailableTags.mockReturnValue({
      availableTags: [],
      isLoading: false,
      error: null,
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
