// src/flags.ts — minimal flag with URL/localStorage override and console notice
type BoolLike = boolean | number | string | null | undefined;
const toBool = (v: BoolLike): boolean => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "1" || s === "true" || s === "on" || s === "yes";
  }
  return false;
};

const AUTH_KEY = "flag.newAuthContext";
const PROJECT_KEY = "flag.projectScoping";

const envAuthBase = toBool((import.meta as any)?.env?.VITE_FLAG_NEW_AUTH_CONTEXT);
const envProjectBase = (() => {
  const envValue = (import.meta as any)?.env?.VITE_FEATURE_PROJECT_SCOPING;
  if (envValue != null) return toBool(envValue);
  return true;
})();

// Apply URL override (auth=on/off/1/0/true/false, or auth=clear)
let urlAction: "set" | "clear" | null = null;
let urlValue: boolean | null = null;
let projectUrlAction: "set" | "clear" | null = null;
let projectUrlValue: boolean | null = null;
if (typeof window !== "undefined") {
  try {
    const qs = new URLSearchParams(window.location.search);
    const raw = (qs.get("auth") ?? qs.get(AUTH_KEY) ?? "").trim().toLowerCase();
    if (raw === "clear" || raw === "reset" || raw === "unset") {
      localStorage.removeItem(AUTH_KEY);
      urlAction = "clear";
    } else if (raw) {
      urlValue = toBool(raw);
      localStorage.setItem(AUTH_KEY, urlValue ? "1" : "0");
      urlAction = "set";
    }

    const projectRaw =
      (qs.get("project") ?? qs.get("projectScope") ?? qs.get(PROJECT_KEY) ?? "")
        .trim()
        .toLowerCase();
    if (projectRaw === "clear" || projectRaw === "reset" || projectRaw === "unset") {
      localStorage.removeItem(PROJECT_KEY);
      projectUrlAction = "clear";
    } else if (projectRaw) {
      projectUrlValue = toBool(projectRaw);
      localStorage.setItem(PROJECT_KEY, projectUrlValue ? "1" : "0");
      projectUrlAction = "set";
    }
  } catch {}
}

let authLsRaw: string | null = null;
let projectLsRaw: string | null = null;
try {
  if (typeof window !== "undefined") {
    authLsRaw = localStorage.getItem(AUTH_KEY);
    projectLsRaw = localStorage.getItem(PROJECT_KEY);
  }
} catch {}
const authLsOverride = authLsRaw !== null ? toBool(authLsRaw) : null;
const projectLsOverride = projectLsRaw !== null ? toBool(projectLsRaw) : null;

export const FLAGS = {
  newAuthContext: authLsOverride ?? envAuthBase,
  projectScoping: projectLsOverride ?? envProjectBase,
};

export const FEATURE_PROJECT_SCOPING = FLAGS.projectScoping;

// Console notice when override is active
if (typeof window !== "undefined") {
  const isOverrideActive =
    (urlAction && urlAction !== "clear") ||
    (authLsOverride !== null && authLsOverride !== envAuthBase);
  const projectOverrideActive =
    (projectUrlAction && projectUrlAction !== "clear") ||
    (projectLsOverride !== null && projectLsOverride !== envProjectBase);
  if (urlAction === "clear") {
    console.info(
      "[Flags] Override for newAuthContext cleared via URL; using env=%s",
      String(envAuthBase)
    );
  } else if (isOverrideActive) {
    const src = urlAction ? "URL" : "localStorage";
    const style = "color:#ab47bc;font-weight:600";
    console.warn(
      "%c[Flags] Override active: newAuthContext=%s (source:%s) — env=%s. Clear with ?auth=clear",
      style,
      String(FLAGS.newAuthContext),
      src,
      String(envAuthBase)
    );
  }
  if (projectUrlAction === "clear") {
    console.info(
      "[Flags] Override for projectScoping cleared via URL; using env=%s",
      String(envProjectBase)
    );
  } else if (projectOverrideActive) {
    const src = projectUrlAction ? "URL" : "localStorage";
    const style = "color:#1d4ed8;font-weight:600";
    console.warn(
      "%c[Flags] Override active: projectScoping=%s (source:%s) — env=%s. Clear with ?project=clear",
      style,
      String(FLAGS.projectScoping),
      src,
      String(envProjectBase)
    );
  }
}
