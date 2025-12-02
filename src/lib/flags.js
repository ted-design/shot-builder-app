function readBool(v) {
  if (v === true) return true;
  if (!v && v !== 0) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

// Env default (Vite-style)
const ENV = (import.meta && import.meta.env) ? import.meta.env : {};

const PROJECT_FLAG_KEY = "flag.projectScoping";
const ASSETS_FLAG_KEY = "flag.projectScopedAssets";
const PULLS_EDITOR_FLAG_KEY = "flag.pullsEditorV2";
const DEMO_FLAG_KEY = "flag.demoMode";
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

const ASSETS_ENV_DEFAULT = (() => {
  if (ENV.VITE_FLAG_PROJECT_SCOPED_ASSETS != null) {
    return readBool(ENV.VITE_FLAG_PROJECT_SCOPED_ASSETS);
  }
  return true;
})();
const DEMO_ENV_DEFAULT = (() => {
  if (ENV.VITE_ENABLE_DEMO_MODE != null) {
    return readBool(ENV.VITE_ENABLE_DEMO_MODE);
  }
  return false;
})();

// Local overrides (set by URL helper)
let AUTH_OVERRIDE = null;
let PROJECT_OVERRIDE = null;
let ASSETS_OVERRIDE = null;
let PULLS_EDITOR_OVERRIDE = null;
let DEMO_OVERRIDE = null;
try {
  if (typeof window !== "undefined") {
    // Allow quick enabling via query param e.g. ?demo=1
    try {
      const params = new URLSearchParams(window.location.search);
      const demoParam = params.get("demo") ?? params.get("demoMode");
      if (demoParam) {
        const trimmed = demoParam.trim().toLowerCase();
        if (trimmed === "clear" || trimmed === "reset" || trimmed === "off") {
          window.localStorage.removeItem(DEMO_FLAG_KEY);
        } else {
          window.localStorage.setItem(DEMO_FLAG_KEY, readBool(demoParam) ? "1" : "0");
        }
      }
    } catch {}

    AUTH_OVERRIDE = window.localStorage.getItem("flag.newAuthContext");
    PROJECT_OVERRIDE = window.localStorage.getItem(PROJECT_FLAG_KEY);
    ASSETS_OVERRIDE = window.localStorage.getItem(ASSETS_FLAG_KEY);
    PULLS_EDITOR_OVERRIDE = window.localStorage.getItem(PULLS_EDITOR_FLAG_KEY);
    DEMO_OVERRIDE = window.localStorage.getItem(DEMO_FLAG_KEY);
  }
} catch {}

export const FLAGS = {
  pdfExport: false,
  productSearch: false,
  newNavbar: false,
  calendarPlanner: false,
  newAuthContext: AUTH_OVERRIDE != null ? readBool(AUTH_OVERRIDE) : !!AUTH_ENV_DEFAULT,
  projectScoping: PROJECT_OVERRIDE != null ? readBool(PROJECT_OVERRIDE) : PROJECT_ENV_DEFAULT,
  projectScopedAssets: ASSETS_OVERRIDE != null ? readBool(ASSETS_OVERRIDE) : ASSETS_ENV_DEFAULT,
  pullsEditorV2:
    PULLS_EDITOR_OVERRIDE != null
      ? readBool(PULLS_EDITOR_OVERRIDE)
      : readBool(ENV.VITE_FLAG_PULLS_EDITOR_V2 ?? false),
  demoMode: DEMO_OVERRIDE != null ? readBool(DEMO_OVERRIDE) : DEMO_ENV_DEFAULT,
};

export const FEATURE_PROJECT_SCOPING = FLAGS.projectScoping;

export function setProjectScopedAssetsOverride(value) {
  try {
    if (typeof window === "undefined") return;
    if (value == null) {
      window.localStorage.removeItem(ASSETS_FLAG_KEY);
    } else {
      window.localStorage.setItem(ASSETS_FLAG_KEY, value ? "1" : "0");
    }
  } catch {}
}

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

export function setPullsEditorV2Override(value) {
  try {
    if (typeof window === "undefined") return;
    if (value == null) {
      window.localStorage.removeItem(PULLS_EDITOR_FLAG_KEY);
    } else {
      window.localStorage.setItem(PULLS_EDITOR_FLAG_KEY, value ? "1" : "0");
    }
  } catch {}
}

export function setDemoModeOverride(value) {
  try {
    if (typeof window === "undefined") return;
    if (value == null) {
      window.localStorage.removeItem(DEMO_FLAG_KEY);
    } else {
      window.localStorage.setItem(DEMO_FLAG_KEY, value ? "1" : "0");
    }
  } catch {}
}
