import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

async function renderScenario({ projects }) {
  vi.resetModules();
  vi.doMock("../../context/AuthContext", () => ({
    useAuth: () => ({ clientId: "test-client", role: "admin" }),
  }));
  vi.doMock("../../hooks/useFirestoreQuery", () => ({
    useProjects: () => ({ data: projects, isLoading: false, error: null }),
  }));

  const { ProjectScopeProvider } = await import("../../context/ProjectScopeContext.jsx");
  const { default: SidebarRecentProjects } = await import("../layout/SidebarRecentProjects.jsx");

  render(
    <MemoryRouter initialEntries={["/projects"]}>
      <ProjectScopeProvider>
        <Routes>
          <Route path="/projects" element={<SidebarRecentProjects isExpanded={true} />} />
          <Route path="/projects/:projectId/dashboard" element={<div>PROJECT DASHBOARD</div>} />
        </Routes>
      </ProjectScopeProvider>
    </MemoryRouter>
  );
}

describe("SidebarRecentProjects navigation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("links recent project items to /projects/:id/dashboard", async () => {
    await renderScenario({
      projects: [{ id: "p1", name: "Recent Project", status: "active", members: {} }],
    });

    const link = screen.getByRole("link", { name: "Recent Project" });
    expect(link).toHaveAttribute("href", "/projects/p1/dashboard");

    fireEvent.click(link);
    expect(screen.getByText("PROJECT DASHBOARD")).toBeInTheDocument();
  });
});
