import React, { useMemo } from "react";
import { FLAGS } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

function parseEnabled() {
  try {
    return new URLSearchParams(window.location.search).get("authBadge") === "1";
  } catch {
    return false;
  }
}

export default function AuthDebugBadge() {
  const enabled = useMemo(() => parseEnabled(), []);
  if (!enabled) return null;

  // If flag is OFF, provider is gated out; show explicit state.
  if (!FLAGS.newAuthContext) {
    return (
      <div
        style={{
          position: "fixed",
          top: 8,
          right: 8,
          zIndex: 10000,
          fontSize: 12,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          background: "rgba(17,24,39,0.9)",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: 6,
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          pointerEvents: "none",
        }}
        aria-live="polite"
      >
        <div style={{ fontWeight: 700 }}>Auth</div>
        <div>FLAG OFF</div>
      </div>
    );
  }

  const { user, initializing } = useAuth();
  const status = initializing ? "LOADING" : user ? "SIGNED IN" : "SIGNED OUT";
  const detail = initializing ? "" : user?.email || user?.uid || "—";

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 10000,
        fontSize: 12,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        background: "rgba(17,24,39,0.9)",
        color: "#fff",
        padding: "4px 8px",
        borderRadius: 6,
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        pointerEvents: "none",
      }}
      aria-live="polite"
    >
      <div style={{ fontWeight: 700 }}>Auth</div>
      <div>{status}</div>
      {detail && <div style={{ opacity: 0.85 }}>{detail}</div>}
    </div>
  );
}
