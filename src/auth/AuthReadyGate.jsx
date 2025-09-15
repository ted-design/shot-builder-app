import React from "react";
import { FLAGS } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

export default function AuthReadyGate({ children, fallback = null }) {
  // Always call hooks at the top-level to satisfy the hooks rules.
  const { initializing } = useAuth();
  if (!FLAGS.newAuthContext) return <>{children}</>;
  const ready = !initializing;
  return ready ? <>{children}</> : <>{fallback}</>;
}
