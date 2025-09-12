import React from "react";
import { FLAGS } from "../lib/flags";
import { AuthProvider } from "./AuthContext";

export default function AuthProviderGated({ children }) {
  if (!FLAGS.newAuthContext) return <>{children}</>;
  return <AuthProvider>{children}</AuthProvider>;
}

