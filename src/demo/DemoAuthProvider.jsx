import React, { useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { demoUser } from "./demoData";

export function DemoAuthProvider({ children }) {
  const value = useMemo(
    () => ({
      user: {
        uid: demoUser.id,
        displayName: demoUser.name,
        email: demoUser.email,
        photoURL: demoUser.avatarUrl,
      },
      initializing: false,
      loadingClaims: false,
      ready: true,
      claims: { role: "producer", clientId: "demo-client" },
      role: "producer",
      clientId: "demo-client",
      projectRoles: {},
      claimsError: null,
      signIn: async () => {},
      signOut: async () => {},
      refreshToken: async () => {},
    }),
    []
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
