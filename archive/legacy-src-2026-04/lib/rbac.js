export const ROLE = {
  ADMIN: "admin",
  PRODUCER: "producer",
  CREW: "crew",
  WAREHOUSE: "warehouse",
  VIEWER: "viewer",
};

const preferObjectKeys = ["role", "default", "value", "type"];

export const resolveRoleValue = (input) => {
  const seen = new Set();

  const visit = (value) => {
    if (!value) return null;

    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        const resolved = visit(entry);
        if (resolved) return resolved;
      }
      return null;
    }

    if (typeof value === "object") {
      if (seen.has(value)) return null;
      seen.add(value);

      for (const key of preferObjectKeys) {
        if (key in value) {
          const resolved = visit(value[key]);
          if (resolved) return resolved;
        }
      }

      for (const entry of Object.values(value)) {
        const resolved = visit(entry);
        if (resolved) return resolved;
      }
    }

    return null;
  };

  return visit(input);
};

export const normalizeRole = (role) => {
  const resolved = resolveRoleValue(role);
  return resolved ? resolved.toLowerCase() : null;
};

const normalize = normalizeRole;

export const resolveEffectiveRole = (globalRole, projectRoles = {}, projectId = null) => {
  const projectValue = projectId ? projectRoles?.[projectId] : null;
  const projectRole = normalize(projectValue);
  if (projectRole) return projectRole;

  const globalResolved = normalize(globalRole);
  return globalResolved ?? ROLE.VIEWER;
};

export const roleLabel = (role) => {
  const r = normalize(role);
  switch (r) {
    case ROLE.ADMIN:
      return "Admin";
    case ROLE.PRODUCER:
      return "Producer";
    case ROLE.CREW:
      return "Crew";
    case ROLE.WAREHOUSE:
      return "Warehouse";
    case ROLE.VIEWER:
    default:
      return "Viewer";
  }
};

export const canManageProjects = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER;
};

export const canManageShots = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER || r === ROLE.CREW;
};

export const canManagePlanner = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER || r === ROLE.CREW;
};

export const canEditProducts = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER;
};

export const canArchiveProducts = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER;
};

export const canDeleteProducts = (role) => normalize(role) === ROLE.ADMIN;

export const canManageProducts = (role) => canEditProducts(role);

export const canManageTalent = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER;
};

export const canManageLocations = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER;
};

export const canManagePulls = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER || r === ROLE.WAREHOUSE;
};

export const canFulfillPulls = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.WAREHOUSE;
};

export const canRequestChangeOrders = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.WAREHOUSE;
};

export const canApproveChangeOrders = (role) => {
  const r = normalize(role);
  return r === ROLE.ADMIN || r === ROLE.PRODUCER;
};

export const isViewer = (role) => normalize(role) === ROLE.VIEWER;
