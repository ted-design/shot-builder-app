import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProjectScopeProvider } from "../../context/ProjectScopeContext";
import ProjectParamScope from "../../routes/ProjectParamScope";
import CataloguePage from "../CataloguePage";

function PeopleStub() {
  return <div>PEOPLE STUB</div>;
}

function LocationsStub() {
  return <div>LOCATIONS STUB</div>;
}

function renderAt(initialPath) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ProjectScopeProvider>
        <Routes>
          <Route path="/projects" element={<div>PROJECTS ROOT</div>} />
          <Route path="/projects/:projectId" element={<ProjectParamScope />}>
            <Route path="catalogue" element={<CataloguePage />}>
              <Route index element={<Navigate to="people" replace />} />
              <Route path="people" element={<PeopleStub />} />
              <Route path="people/talent" element={<PeopleStub />} />
              <Route path="people/crew" element={<PeopleStub />} />
              <Route path="locations" element={<LocationsStub />} />
            </Route>
          </Route>
        </Routes>
      </ProjectScopeProvider>
    </MemoryRouter>
  );
}

describe("project catalogue routes", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders People for /catalogue/people/talent", async () => {
    renderAt("/projects/p1/catalogue/people/talent");
    expect(await screen.findByText("PEOPLE STUB")).toBeInTheDocument();
  });

  it("renders People for /catalogue/people/crew", async () => {
    renderAt("/projects/p1/catalogue/people/crew");
    expect(await screen.findByText("PEOPLE STUB")).toBeInTheDocument();
  });

  it("renders Locations for /catalogue/locations", async () => {
    renderAt("/projects/p1/catalogue/locations");
    expect(await screen.findByText("LOCATIONS STUB")).toBeInTheDocument();
  });

  it("redirects /catalogue to /catalogue/people", async () => {
    renderAt("/projects/p1/catalogue");
    expect(await screen.findByText("PEOPLE STUB")).toBeInTheDocument();
  });
});

