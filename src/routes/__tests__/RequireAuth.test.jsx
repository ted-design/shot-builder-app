import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

async function renderScenario({ flagOn, auth, start = "/secret", to = "/login" }) {
  vi.resetModules();
  vi.doMock("../../lib/flags", () => ({ FLAGS: { newAuthContext: flagOn } }), { virtual: true });
  vi.doMock("../../context/AuthContext", () => ({ useAuth: () => auth }), { virtual: true });
  const { default: RequireAuth } = await import("../RequireAuth.jsx");
  render(
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route element={<RequireAuth to={to} />}>
          <Route path="/secret" element={<div>SECRET</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAuth", () => {
  it("flag OFF: passes through (renders protected content)", async () => {
    await renderScenario({ flagOn: false, auth: { user: null, ready: false } });
    expect(screen.queryByText("SECRET")).toBeTruthy();
  });

  it("flag ON + not ready: renders nothing (no redirect, no content)", async () => {
    await renderScenario({ flagOn: true, auth: { user: null, ready: false } });
    expect(screen.queryByText("SECRET")).toBeNull();
    expect(screen.queryByText("LOGIN")).toBeNull();
  });

  it("flag ON + signed out: redirects to login", async () => {
    await renderScenario({ flagOn: true, auth: { user: null, ready: true } });
    expect(screen.queryByText("LOGIN")).toBeTruthy();
  });

  it("flag ON + signed in: renders protected content", async () => {
    await renderScenario({ flagOn: true, auth: { user: { uid: "u1" }, ready: true } });
    expect(screen.queryByText("SECRET")).toBeTruthy();
  });
});
