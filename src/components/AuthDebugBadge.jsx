import React, { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

function parseEnabled() {
  try {
    return new URLSearchParams(window.location.search).get("authBadge") === "1";
  } catch {
    return false;
  }
}

export default function AuthDebugBadge() {
  const { user, initializing } = useAuth();
  const enabled = useMemo(() => parseEnabled(), []);
  if (!enabled) return null;

  const label = initializing ? "Auth…" : user ? user.email || "Signed in" : "Signed out";

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 10000,
        fontSize: 12,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        background: "rgba(17,24,39,0.9)",
        color: "#fff",
        padding: "4px 8px",
        borderRadius: 6,
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        pointerEvents: "none",
      }}
      aria-live="polite"
    >
      {label}
    </div>
  );
}

