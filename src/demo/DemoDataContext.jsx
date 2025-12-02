import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  demoActivities,
  demoLocations,
  demoProducts,
  demoProjects,
  demoPulls,
  demoShotsByProject,
  demoTalent,
  demoUser,
} from "./demoData";

const DemoDataContext = createContext(null);

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `demo-${Math.random().toString(36).slice(2, 10)}`;
}

function formatDate(date) {
  if (!date) return null;
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {}
  return null;
}

export function DemoDataProvider({ children }) {
  const [projects, setProjects] = useState(demoProjects);
  const [shotsByProject, setShotsByProject] = useState(demoShotsByProject);
  const [activities, setActivities] = useState(demoActivities);
  const [pulls, setPulls] = useState(demoPulls);
  const [currentProjectId, setCurrentProjectId] = useState(demoProjects[0]?.id ?? null);

  const productsById = useMemo(() => {
    const map = new Map();
    demoProducts.forEach((product) => map.set(product.id, product));
    return map;
  }, []);
  const talentById = useMemo(() => {
    const map = new Map();
    demoTalent.forEach((person) => map.set(person.id, person));
    return map;
  }, []);
  const locationsById = useMemo(() => {
    const map = new Map();
    demoLocations.forEach((loc) => map.set(loc.id, loc));
    return map;
  }, []);

  const projectMap = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => map.set(project.id, project));
    return map;
  }, [projects]);

  const projectsWithStats = useMemo(
    () =>
      projects.map((project) => {
        const projectShots = shotsByProject[project.id] || [];
        const shotCount = projectShots.length;
        const planned = project.stats?.shotsPlanned ?? shotCount;
        return {
          ...project,
          shotCount,
          stats: {
            ...(project.stats || {}),
            shots: shotCount,
            shotsPlanned: Math.min(planned, shotCount || planned),
          },
        };
      }),
    [projects, shotsByProject]
  );

  const currentShots = useMemo(
    () => (currentProjectId ? shotsByProject[currentProjectId] || [] : []),
    [currentProjectId, shotsByProject]
  );

  const addActivity = useCallback(
    (entry) => {
      const payload = {
        id: randomId(),
        createdAt: new Date().toISOString(),
        actor: entry.actor || demoUser.name,
        ...entry,
      };
      setActivities((prev) => [payload, ...prev].slice(0, 40));
    },
    []
  );

  const addShot = useCallback(
    (projectId = currentProjectId, overrides = {}) => {
      if (!projectId) return null;
      const date = formatDate(overrides.date) || formatDate(new Date());
      const templateName =
        overrides.name ||
        `New shot ${((shotsByProject[projectId] || []).length + 1)
          .toString()
          .padStart(2, "0")}`;

      const shot = {
        id: randomId(),
        shotNumber: overrides.shotNumber || `S-${((shotsByProject[projectId] || []).length + 1).toString().padStart(2, "0")}`,
        name: templateName,
        type: overrides.type || "Storyboard shot",
        status: overrides.status || "todo",
        date,
        locationId: overrides.locationId || demoLocations[0]?.id || null,
        productIds: overrides.productIds || [demoProducts[0]?.id].filter(Boolean),
        talentIds: overrides.talentIds || [demoTalent[0]?.id].filter(Boolean),
        tags: overrides.tags || [],
        notes: overrides.notes || "<p>Placeholder note — this is demo-only.</p>",
        coverUrl: overrides.coverUrl || demoProducts[0]?.heroImage || null,
      };

      setShotsByProject((prev) => {
        const list = prev[projectId] || [];
        return { ...prev, [projectId]: [...list, shot] };
      });

      addActivity({
        projectId,
        summary: `Created “${shot.name}”`,
        detail: "Demo-only add; nothing persisted to your backend.",
      });

      return shot;
    },
    [addActivity, currentProjectId, shotsByProject]
  );

  const updateShot = useCallback(
    (projectId, shotId, updates) => {
      if (!projectId || !shotId) return;
      setShotsByProject((prev) => {
        const list = prev[projectId] || [];
        return {
          ...prev,
          [projectId]: list.map((shot) =>
            shot.id === shotId ? { ...shot, ...updates } : shot
          ),
        };
      });

      if (updates.status) {
        addActivity({
          projectId,
          summary: `Updated status to ${updates.status}`,
          detail: `Shot ${shotId} is now ${updates.status}`,
        });
      }
    },
    [addActivity]
  );

  const reorderShots = useCallback((projectId, fromIndex, toIndex) => {
    if (!projectId) return;
    setShotsByProject((prev) => {
      const list = prev[projectId] || [];
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= list.length ||
        toIndex >= list.length
      ) {
        return prev;
      }
      const next = [...list];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, [projectId]: next };
    });
  }, []);

  const addProject = useCallback(
    (name) => {
      const newProject = {
        id: randomId(),
        name: name || "Untitled demo project",
        status: "active",
        notes: "Demo-only project. Safe to click around.",
        shootDates: [formatDate(new Date())],
        stats: { shots: 0, shotsPlanned: 0 },
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) => [...prev, newProject]);
      setCurrentProjectId(newProject.id);
      addActivity({
        projectId: newProject.id,
        summary: `Created project “${newProject.name}”`,
        detail: "Demo-only project; nothing persisted.",
      });
      return newProject;
    },
    [addActivity]
  );

  const togglePullSharing = useCallback((pullId) => {
    setPulls((prev) =>
      prev.map((pull) =>
        pull.id === pullId ? { ...pull, shared: !pull.shared } : pull
      )
    );
  }, []);

  const value = useMemo(
    () => ({
      demoUser,
      projects: projectsWithStats,
      projectMap,
      currentProjectId,
      setCurrentProjectId,
      shotsByProject,
      currentShots,
      products: demoProducts,
      productsById,
      talent: demoTalent,
      talentById,
      locations: demoLocations,
      locationsById,
      pulls,
      activities,
      addShot,
      updateShot,
      reorderShots,
      addProject,
      addActivity,
      togglePullSharing,
    }),
    [
      activities,
      addProject,
      addShot,
      currentProjectId,
      currentShots,
      locationsById,
      pulls,
      projectMap,
      projectsWithStats,
      productsById,
      reorderShots,
      shotsByProject,
      talentById,
      togglePullSharing,
      updateShot,
    ]
  );

  return <DemoDataContext.Provider value={value}>{children}</DemoDataContext.Provider>;
}

export function useDemoData() {
  const ctx = useContext(DemoDataContext);
  if (!ctx) {
    throw new Error("useDemoData must be used within a DemoDataProvider");
  }
  return ctx;
}
