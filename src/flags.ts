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
const DEMO_KEY = "flag.demoMode";

const envAuthBase = toBool((import.meta as any)?.env?.VITE_FLAG_NEW_AUTH_CONTEXT);
const envProjectBase = (() => {
  const envValue = (import.meta as any)?.env?.VITE_FEATURE_PROJECT_SCOPING;
  if (envValue != null) return toBool(envValue);
  return true;
})();
const envDemoBase = toBool((import.meta as any)?.env?.VITE_ENABLE_DEMO_MODE);

// Apply URL override (auth=on/off/1/0/true/false, or auth=clear)
let urlAction: "set" | "clear" | null = null;
let urlValue: boolean | null = null;
let projectUrlAction: "set" | "clear" | null = null;
let projectUrlValue: boolean | null = null;
let demoUrlAction: "set" | "clear" | null = null;
let demoUrlValue: boolean | null = null;
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

    const demoRaw =
      (qs.get("demo") ?? qs.get("demoMode") ?? qs.get(DEMO_KEY) ?? "")
        .trim()
        .toLowerCase();
    if (demoRaw === "clear" || demoRaw === "reset" || demoRaw === "unset") {
      localStorage.removeItem(DEMO_KEY);
      demoUrlAction = "clear";
    } else if (demoRaw) {
      demoUrlValue = toBool(demoRaw);
      localStorage.setItem(DEMO_KEY, demoUrlValue ? "1" : "0");
      demoUrlAction = "set";
    }
  } catch {}
}

let authLsRaw: string | null = null;
let projectLsRaw: string | null = null;
let demoLsRaw: string | null = null;
try {
  if (typeof window !== "undefined") {
    authLsRaw = localStorage.getItem(AUTH_KEY);
    projectLsRaw = localStorage.getItem(PROJECT_KEY);
    demoLsRaw = localStorage.getItem(DEMO_KEY);
  }
} catch {}
const authLsOverride = authLsRaw !== null ? toBool(authLsRaw) : null;
const projectLsOverride = projectLsRaw !== null ? toBool(projectLsRaw) : null;
const demoLsOverride = demoLsRaw !== null ? toBool(demoLsRaw) : null;

export const FLAGS = {
  newAuthContext: authLsOverride ?? envAuthBase,
  projectScoping: projectLsOverride ?? envProjectBase,
  demoMode: demoLsOverride ?? envDemoBase,
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
  const demoOverrideActive =
    (demoUrlAction && demoUrlAction !== "clear") ||
    (demoLsOverride !== null && demoLsOverride !== envDemoBase);
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
  if (demoUrlAction === "clear") {
    console.info(
      "[Flags] Override for demoMode cleared via URL; using env=%s",
      String(envDemoBase)
    );
  } else if (demoOverrideActive) {
    const src = demoUrlAction ? "URL" : "localStorage";
    const style = "color:#0891b2;font-weight:600";
    console.warn(
      "%c[Flags] Override active: demoMode=%s (source:%s) — env=%s. Clear with ?demo=clear",
      style,
      String(FLAGS.demoMode),
      src,
      String(envDemoBase)
    );
  }
}
