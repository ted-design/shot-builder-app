import React from "react";
import { FLAGS } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

export default function AuthReadyGate({ children, fallback = null }) {
  if (!FLAGS.newAuthContext) return <>{children}</>;
  const { initializing } = useAuth();
  const ready = !initializing;
  return ready ? <>{children}</> : <>{fallback}</>;
}

