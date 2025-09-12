function readBool(v) {
  if (v === true) return true;
  if (!v && v !== 0) return false;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "on" || s === "yes";
}

// Env default (Vite-style)
const ENV = (import.meta && import.meta.env) ? import.meta.env : {};
const ENV_DEFAULT = readBool(ENV.VITE_FLAG_NEW_AUTH_CONTEXT);

// Local override (set by URL helper)
let OVERRIDE = null;
try {
  if (typeof window !== "undefined") {
    OVERRIDE = window.localStorage.getItem("flag.newAuthContext");
  }
} catch {}

export const FLAGS = {
  pdfExport: false,
  productSearch: false,
  newNavbar: false,
  calendarPlanner: false,
  newAuthContext: OVERRIDE != null ? readBool(OVERRIDE) : !!ENV_DEFAULT,
};
