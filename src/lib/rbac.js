export const ROLE = {
  ADMIN: "admin",
  PRODUCER: "producer",
  CREW: "crew",
  WAREHOUSE: "warehouse",
  VIEWER: "viewer",
};

const normalize = (role) => (role ? String(role).toLowerCase() : null);

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

export const isViewer = (role) => normalize(role) === ROLE.VIEWER;
