import { describe, it, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// mock flags with default OFF unless overridden
vi.mock("../../lib/flags", () => ({ FLAGS: { newAuthContext: false } }));

// mock NavBar to capture props
vi.mock("../NavBar", () => ({
  __esModule: true,
  default: ({ user }) => <div data-testid="navbar" data-user={user ? "yes" : "no"} />,
}));

// mock AuthContext
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: null, ready: true }),
}));

describe("NavBarWithAuth", () => {
  it("flag OFF: renders NavBar with null user", async () => {
    // fresh import with default mocks
    const { default: NavBarWithAuth } = await import("../NavBarWithAuth");
    render(<NavBarWithAuth />);
    expect(screen.getByTestId("navbar").getAttribute("data-user")).toBe("no");
  });

  it("flag ON + signed in: passes adapted user", async () => {
    vi.resetModules();
    vi.doMock("../../lib/flags", () => ({ FLAGS: { newAuthContext: true } }), { virtual: true });
    vi.doMock(
      "../../context/AuthContext",
      () => ({
        useAuth: () => ({
          user: {
            uid: "u1",
            displayName: "Ted",
            email: "ted@example.com",
            photoURL: "p",
            emailVerified: true,
            providerData: [{ providerId: "google.com" }],
          },
          ready: true,
        }),
      }),
      { virtual: true }
    );

    const { default: FreshNavBarWithAuth } = await import("../NavBarWithAuth");
    render(<FreshNavBarWithAuth />);
    expect(screen.getByTestId("navbar").getAttribute("data-user")).toBe("yes");
  });

  it("flag ON + not ready: renders nothing", async () => {
    vi.resetModules();
    vi.doMock("../../lib/flags", () => ({ FLAGS: { newAuthContext: true } }), { virtual: true });
    vi.doMock(
      "../../context/AuthContext",
      () => ({
        useAuth: () => ({ user: null, ready: false }),
      }),
      { virtual: true }
    );

    const { default: Fresh } = await import("../NavBarWithAuth");
    const { container } = render(<Fresh />);
    expect(container).toBeEmptyDOMElement();
  });
});
