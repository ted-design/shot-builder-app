import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

async function renderScenario({ projects }) {
  vi.resetModules();
  vi.doMock("../../context/AuthContext", () => ({
    useAuth: () => ({ clientId: "test-client", user: { uid: "u1" }, role: "admin" }),
  }));
  vi.doMock("../../hooks/useFirestoreQuery", () => ({
    useProjects: () => ({ data: projects, isLoading: false, error: null }),
  }));

  const { ProjectScopeProvider } = await import("../../context/ProjectScopeContext.jsx");
  const { default: ProjectsPage } = await import("../ProjectsPage.jsx");

  render(
    <MemoryRouter initialEntries={["/projects"]}>
      <ProjectScopeProvider>
        <Routes>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId/dashboard" element={<div>PROJECT DASHBOARD</div>} />
          <Route path="/library/tags" element={<div>LIBRARY TAGS</div>} />
        </Routes>
      </ProjectScopeProvider>
    </MemoryRouter>
  );
}

describe("ProjectsPage navigation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("navigates to /projects/:id/dashboard when a project card is clicked", async () => {
    await renderScenario({
      projects: [{ id: "p1", name: "Test Project", status: "active", members: {} }],
    });

    fireEvent.click(screen.getByText("Test Project"));
    expect(screen.getByText("PROJECT DASHBOARD")).toBeInTheDocument();
    expect(screen.queryByText("LIBRARY TAGS")).not.toBeInTheDocument();
  });
});
