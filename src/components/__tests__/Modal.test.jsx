import { describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "../ui/modal";

function setupModal({ onClose = vi.fn(), children = null } = {}) {
  render(
    <Modal open onClose={onClose} labelledBy="test-title">
      <div className="p-4">
        <h2 id="test-title">Modal Title</h2>
        {children || (
          <div className="flex gap-2">
            <button type="button">First</button>
            <button type="button">Second</button>
          </div>
        )}
      </div>
    </Modal>
  );
  return onClose;
}

describe("Modal", () => {
  it("calls onClose when escape is pressed", () => {
    const onClose = setupModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking the backdrop", () => {
    const onClose = setupModal();
    const overlay = screen.getByTestId("modal-overlay");
    fireEvent.mouseDown(overlay, { bubbles: true });
    fireEvent.mouseUp(overlay, { bubbles: true });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps focus within the modal", () => {
    setupModal();
    const buttons = screen.getAllByRole("button");
    const focusFirst = vi.spyOn(buttons[0], "focus");
    const focusSecond = vi.spyOn(buttons[1], "focus");

    buttons[1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(focusFirst).toHaveBeenCalled();

    buttons[0].focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(focusSecond).toHaveBeenCalled();

    focusFirst.mockRestore();
    focusSecond.mockRestore();
  });
});
