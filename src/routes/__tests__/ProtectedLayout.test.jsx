import React from "react";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ProtectedLayout from "../ProtectedLayout.jsx";
import { AuthContext } from "../../context/AuthContext.jsx";

function renderWithAuth(ui, { user = null, initializing = false, initialEntries = ["/"] } = {}) {
  const authValue = { user, initializing, signIn: async () => {}, signOut: async () => {} };
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("ProtectedLayout", () => {
  it("redirects unauthenticated users from protected routes to /login", () => {
    renderWithAuth(
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<ProtectedLayout />}>
          <Route path="/projects" element={<div>Projects</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/projects" />} />
      </Routes>,
      { user: null, initializing: false, initialEntries: ["/projects"] }
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("allows public routes like /login to render without redirect", () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedLayout allowlist={["/", "/login"]} />}>
          <Route path="/login" element={<div>Login Page</div>} />
        </Route>
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>,
      { user: null, initializing: false, initialEntries: ["/login"] }
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });
});
