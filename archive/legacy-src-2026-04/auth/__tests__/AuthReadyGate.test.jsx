import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

async function renderGate({ flagOn, authState, fallback = <div>LOADING</div> }) {
  vi.resetModules();
  vi.doMock("../../lib/flags", () => ({ FLAGS: { newAuthContext: flagOn } }), { virtual: true });
  vi.doMock("../../context/AuthContext", () => ({ useAuth: () => authState }), { virtual: true });
  const { default: AuthReadyGate } = await import("../AuthReadyGate.jsx");
  render(
    <AuthReadyGate fallback={fallback}>
      <div>CONTENT</div>
    </AuthReadyGate>
  );
}

describe("AuthReadyGate", () => {
  it("flag OFF: always renders children", async () => {
    await renderGate({ flagOn: false, authState: { ready: false } });
    expect(screen.queryByText("CONTENT")).toBeTruthy();
  });

  it("flag ON + waiting: renders fallback", async () => {
    await renderGate({
      flagOn: true,
      authState: { initializing: true, loadingClaims: false, ready: false },
    });
    expect(screen.queryByText("LOADING")).toBeTruthy();
    expect(screen.queryByText("CONTENT")).toBeNull();
  });

  it("flag ON + ready: renders children", async () => {
    await renderGate({
      flagOn: true,
      authState: { initializing: false, loadingClaims: false, ready: true },
    });
    expect(screen.queryByText("CONTENT")).toBeTruthy();
  });
});

