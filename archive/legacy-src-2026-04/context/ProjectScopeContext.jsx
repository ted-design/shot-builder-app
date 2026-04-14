import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readStorage, writeStorage, removeStorage } from "../lib/safeStorage";

const ACTIVE_PROJECT_STORAGE_KEY = "ACTIVE_PROJECT_ID";
const LAST_SECTION_STORAGE_KEY = "ACTIVE_PROJECT_LAST_SECTION";

const ProjectScopeContext = createContext(null);

export function ProjectScopeProvider({ children }) {
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [lastVisitedPath, setLastVisitedPath] = useState("/shots");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedProject = readStorage(ACTIVE_PROJECT_STORAGE_KEY, null);
    if (storedProject && typeof storedProject === "string") {
      setCurrentProjectId(storedProject);
    }
    const storedPath = readStorage(LAST_SECTION_STORAGE_KEY, "/shots");
    if (storedPath && typeof storedPath === "string") {
      setLastVisitedPath(storedPath.startsWith("/") ? storedPath : "/shots");
    }
    setReady(true);
  }, []);

  const updateProjectId = useCallback((nextId) => {
    const normalised = typeof nextId === "string" && nextId ? nextId : null;
    setCurrentProjectId(normalised);
    if (normalised) {
      writeStorage(ACTIVE_PROJECT_STORAGE_KEY, normalised);
    } else {
      removeStorage(ACTIVE_PROJECT_STORAGE_KEY);
    }
  }, []);

  const rememberPath = useCallback((path) => {
    if (typeof path !== "string" || !path.startsWith("/")) return;
    setLastVisitedPath(path);
    writeStorage(LAST_SECTION_STORAGE_KEY, path);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleStorage = (event) => {
      if (event.key === ACTIVE_PROJECT_STORAGE_KEY) {
        const value = event.newValue && typeof event.newValue === "string" ? event.newValue : null;
        setCurrentProjectId(value);
      }
      if (event.key === LAST_SECTION_STORAGE_KEY && event.newValue) {
        const value = typeof event.newValue === "string" ? event.newValue : null;
        if (value && value.startsWith("/")) {
          setLastVisitedPath(value);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      currentProjectId,
      setCurrentProjectId: updateProjectId,
      clearCurrentProject: () => updateProjectId(null),
      lastVisitedPath,
      setLastVisitedPath: rememberPath,
    }),
    [ready, currentProjectId, updateProjectId, lastVisitedPath, rememberPath]
  );

  return <ProjectScopeContext.Provider value={value}>{children}</ProjectScopeContext.Provider>;
}

export function useProjectScope() {
  const context = useContext(ProjectScopeContext);
  if (!context) {
    throw new Error("useProjectScope must be used within a ProjectScopeProvider");
  }
  return context;
}

export const PROJECT_SCOPE_KEYS = {
  activeProject: ACTIVE_PROJECT_STORAGE_KEY,
  lastSection: LAST_SECTION_STORAGE_KEY,
};
