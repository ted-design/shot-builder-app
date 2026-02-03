import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

globalThis.React = React;

async function renderScenario({ shot, readOnly = false }) {
  vi.resetModules();

  const updateShotWithVersion = vi.fn(async () => {});
  const toastInfo = vi.fn();
  const toastError = vi.fn();

  vi.doMock("../../../context/AuthContext", () => ({
    useAuth: () => ({ clientId: "test-client", user: { uid: "u1", displayName: "Test User" } }),
  }));
  vi.doMock("../../../lib/updateShotWithVersion", () => ({
    updateShotWithVersion,
  }));
  vi.doMock("../../../lib/toast", () => ({
    toast: {
      info: toastInfo,
      error: toastError,
      success: vi.fn(),
      warning: vi.fn(),
    },
  }));

  const { default: ShotReaderView } = await import("../ShotReaderView.jsx");

  render(
    <MemoryRouter initialEntries={["/projects/p1/shots/s1/editor"]}>
      <Routes>
        <Route
          path="/projects/:projectId/shots/:shotId/editor"
          element={<ShotReaderView shot={shot} readOnly={readOnly} />}
        />
      </Routes>
    </MemoryRouter>
  );

  return { updateShotWithVersion, toastInfo, toastError };
}

describe("ShotReaderView - mobile status operational control", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("updates shot status and exposes an Undo action", async () => {
    const { updateShotWithVersion, toastInfo } = await renderScenario({
      shot: { id: "s1", name: "Test Shot", status: "todo" },
    });

    const select = screen.getByLabelText("Shot status");
    fireEvent.change(select, { target: { value: "complete" } });

    await waitFor(() => {
      expect(updateShotWithVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "test-client",
          shotId: "s1",
          patch: { status: "complete" },
          source: "ShotReaderView:status",
        })
      );
    });

    await waitFor(() => {
      expect(toastInfo).toHaveBeenCalled();
    });

    // Undo action is emitted on the toast payload
    const payload = toastInfo.mock.calls[0][0];
    expect(payload.action.label).toBe("Undo");
    expect(typeof payload.action.onClick).toBe("function");

    await payload.action.onClick();

    expect(updateShotWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "test-client",
        shotId: "s1",
        patch: { status: "todo" },
        source: "ShotReaderView:status:undo",
      })
    );
  });

  it("disables status changes in read-only mode", async () => {
    await renderScenario({
      shot: { id: "s1", name: "Test Shot", status: "todo" },
      readOnly: true,
    });

    const select = screen.getByLabelText("Shot status");
    expect(select).toBeDisabled();
  });
});
