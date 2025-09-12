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

const KEY = "flag.newAuthContext";
const envBase = toBool((import.meta as any)?.env?.VITE_FLAG_NEW_AUTH_CONTEXT);

// Apply URL override (auth=on/off/1/0/true/false, or auth=clear)
let urlAction: "set" | "clear" | null = null;
let urlValue: boolean | null = null;
if (typeof window !== "undefined") {
  try {
    const qs = new URLSearchParams(window.location.search);
    const raw = (qs.get("auth") ?? qs.get(KEY) ?? "").trim().toLowerCase();
    if (raw === "clear" || raw === "reset" || raw === "unset") {
      localStorage.removeItem(KEY);
      urlAction = "clear";
    } else if (raw) {
      urlValue = toBool(raw);
      localStorage.setItem(KEY, urlValue ? "1" : "0");
      urlAction = "set";
    }
  } catch {}
}

let lsRaw: string | null = null;
try { lsRaw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null; } catch {}
const lsOverride = lsRaw !== null ? toBool(lsRaw) : null;

export const FLAGS = {
  newAuthContext: lsOverride ?? envBase,
};

// Console notice when override is active
if (typeof window !== "undefined") {
  const isOverrideActive =
    (urlAction && urlAction !== "clear") || (lsOverride !== null && lsOverride !== envBase);
  if (urlAction === "clear") {
    console.info("[Flags] Override for newAuthContext cleared via URL; using env=%s", String(envBase));
  } else if (isOverrideActive) {
    const src = urlAction ? "URL" : "localStorage";
    const style = "color:#ab47bc;font-weight:600";
    console.warn(
      "%c[Flags] Override active: newAuthContext=%s (source:%s) — env=%s. Clear with ?auth=clear",
      style,
      String(FLAGS.newAuthContext),
      src,
      String(envBase)
    );
  }
}
