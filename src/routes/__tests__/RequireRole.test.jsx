import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

async function renderScenario({ flagOn, auth, roles = ["admin"], fallbackPath = "/projects" }) {
  vi.resetModules();
  vi.doMock("../../lib/flags", () => ({ FLAGS: { newAuthContext: flagOn } }), { virtual: true });
  vi.doMock("../../context/AuthContext", () => ({ useAuth: () => auth }), { virtual: true });
  const { default: RequireRole } = await import("../RequireRole.jsx");
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/projects" element={<div>PROJECTS</div>} />
        <Route
          path="/admin"
          element={
            <RequireRole roles={roles} fallbackPath={fallbackPath}>
              <div>ADMIN</div>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireRole", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("flag OFF: renders children without role checks", async () => {
    await renderScenario({ flagOn: false, auth: { role: null } });
    expect(screen.queryByText("ADMIN")).toBeTruthy();
  });

  it("flag ON + auth loading: renders nothing to avoid flashes", async () => {
    await renderScenario({
      flagOn: true,
      auth: { role: null, initializing: true, loadingClaims: false, ready: false },
    });
    expect(screen.queryByText("ADMIN")).toBeNull();
    expect(screen.queryByText("PROJECTS")).toBeNull();
  });

  it("flag ON + missing role: redirects to fallback", async () => {
    await renderScenario({
      flagOn: true,
      auth: { role: "producer", initializing: false, loadingClaims: false, ready: true },
      roles: ["admin"],
      fallbackPath: "/projects",
    });
    expect(screen.queryByText("PROJECTS")).toBeTruthy();
  });

  it("flag ON + role match: renders children", async () => {
    await renderScenario({
      flagOn: true,
      auth: { role: "admin", initializing: false, loadingClaims: false, ready: true },
      roles: ["admin"],
    });
    expect(screen.queryByText("ADMIN")).toBeTruthy();
  });
});

