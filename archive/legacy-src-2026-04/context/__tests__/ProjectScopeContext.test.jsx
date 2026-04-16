import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import {
  ProjectScopeProvider,
  useProjectScope,
  PROJECT_SCOPE_KEYS,
} from "../ProjectScopeContext";

function ScopeProbe() {
  const { currentProjectId, lastVisitedPath, setCurrentProjectId, setLastVisitedPath, ready } =
    useProjectScope();
  return (
    <div>
      <div data-testid="scope-ready">{ready ? "ready" : "pending"}</div>
      <div data-testid="scope-project">{currentProjectId || ""}</div>
      <div data-testid="scope-path">{lastVisitedPath}</div>
      <button type="button" onClick={() => setCurrentProjectId("next-project")}>set-project</button>
      <button type="button" onClick={() => setCurrentProjectId(null)}>clear-project</button>
      <button type="button" onClick={() => setLastVisitedPath("/planner")}>set-path</button>
    </div>
  );
}

describe("ProjectScopeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hydrates current project and persists updates", async () => {
    window.localStorage.setItem(PROJECT_SCOPE_KEYS.activeProject, "stored-project");
    render(
      <ProjectScopeProvider>
        <ScopeProbe />
      </ProjectScopeProvider>
    );

    expect(await screen.findByText("ready")).toBeInTheDocument();
    expect(screen.getByTestId("scope-project").textContent).toBe("stored-project");

    fireEvent.click(screen.getByText("set-project"));
    expect(screen.getByTestId("scope-project").textContent).toBe("next-project");
    expect(window.localStorage.getItem(PROJECT_SCOPE_KEYS.activeProject)).toBe("next-project");

    fireEvent.click(screen.getByText("clear-project"));
    expect(screen.getByTestId("scope-project").textContent).toBe("");
    expect(window.localStorage.getItem(PROJECT_SCOPE_KEYS.activeProject)).toBeNull();
  });

  it("remembers last visited path", async () => {
    render(
      <ProjectScopeProvider>
        <ScopeProbe />
      </ProjectScopeProvider>
    );

    expect(await screen.findByText("ready")).toBeInTheDocument();
    expect(screen.getByTestId("scope-path").textContent).toBe("/shots");

    fireEvent.click(screen.getByText("set-path"));
    expect(screen.getByTestId("scope-path").textContent).toBe("/planner");
    expect(window.localStorage.getItem(PROJECT_SCOPE_KEYS.lastSection)).toBe("/planner");
  });

  it("reacts to storage events", async () => {
    render(
      <ProjectScopeProvider>
        <ScopeProbe />
      </ProjectScopeProvider>
    );

    expect(await screen.findByText("ready")).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PROJECT_SCOPE_KEYS.activeProject,
          newValue: "synced-project",
        })
      );
    });

    expect(screen.getByTestId("scope-project").textContent).toBe("synced-project");
  });
});
