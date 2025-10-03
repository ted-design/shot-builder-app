function readBool(v) {
  if (v === true) return true;
  if (!v && v !== 0) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

// Env default (Vite-style)
const ENV = (import.meta && import.meta.env) ? import.meta.env : {};

const PROJECT_FLAG_KEY = "flag.projectScoping";
const PROJECT_ENV_DEFAULT = (() => {
  if (ENV.VITE_FEATURE_PROJECT_SCOPING != null) {
    return readBool(ENV.VITE_FEATURE_PROJECT_SCOPING);
  }
  // Default new behaviour to on so the feature can ship progressively.
  return true;
})();

const AUTH_ENV_DEFAULT = (() => {
  const envFlag =
    ENV.VITE_FLAG_NEW_AUTH_CONTEXT != null
      ? ENV.VITE_FLAG_NEW_AUTH_CONTEXT
      : "1"; // Always default to enabled
  return readBool(envFlag);
})();

// Local overrides (set by URL helper)
let AUTH_OVERRIDE = null;
let PROJECT_OVERRIDE = null;
try {
  if (typeof window !== "undefined") {
    AUTH_OVERRIDE = window.localStorage.getItem("flag.newAuthContext");
    PROJECT_OVERRIDE = window.localStorage.getItem(PROJECT_FLAG_KEY);
  }
} catch {}

export const FLAGS = {
  pdfExport: false,
  productSearch: false,
  newNavbar: false,
  calendarPlanner: false,
  newAuthContext: AUTH_OVERRIDE != null ? readBool(AUTH_OVERRIDE) : !!AUTH_ENV_DEFAULT,
  projectScoping: PROJECT_OVERRIDE != null ? readBool(PROJECT_OVERRIDE) : PROJECT_ENV_DEFAULT,
};

export const FEATURE_PROJECT_SCOPING = FLAGS.projectScoping;

export function setProjectScopingOverride(value) {
  try {
    if (typeof window === "undefined") return;
    if (value == null) {
      window.localStorage.removeItem(PROJECT_FLAG_KEY);
    } else {
      window.localStorage.setItem(PROJECT_FLAG_KEY, value ? "1" : "0");
    }
  } catch {}
}
