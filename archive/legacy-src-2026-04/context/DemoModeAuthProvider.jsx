/**
 * DemoModeAuthProvider
 *
 * When demo mode is active (?demo=true), this provider bypasses Firebase Auth
 * and provides synthetic credentials that allow browsing the app with real data.
 *
 * The demo user has:
 * - clientId: "unbound-merino" (to access real data)
 * - role: "producer" (full UI access for design review)
 * - A mock user object that satisfies component requirements
 */
import { useMemo } from "react";
import { AuthContext } from "./AuthContext";

// Demo user configuration
const DEMO_CONFIG = {
  clientId: "unbound-merino",
  role: "producer",
  user: {
    uid: "demo-user-readonly",
    displayName: "Demo User",
    email: "demo@shotbuilder.app",
    photoURL: null,
    emailVerified: true,
    // Mock Firebase User methods that components might call
    getIdToken: async () => "demo-token",
    getIdTokenResult: async () => ({
      claims: {
        role: "producer",
        clientId: "unbound-merino",
        isDemo: true,
      },
    }),
  },
};

/**
 * Wraps children with a synthetic AuthContext when demo mode is enabled.
 * When not enabled, simply renders children (real AuthProvider handles auth).
 */
export function DemoModeAuthProvider({ children, enabled }) {
  const value = useMemo(
    () => ({
      user: DEMO_CONFIG.user,
      initializing: false,
      loadingClaims: false,
      ready: true,
      claims: {
        role: DEMO_CONFIG.role,
        clientId: DEMO_CONFIG.clientId,
        isDemo: true,
      },
      role: DEMO_CONFIG.role,
      clientId: DEMO_CONFIG.clientId,
      projectRoles: {},
      claimsError: null,
      signIn: async () => {
        console.info("[Demo Mode] Sign-in is disabled in demo mode");
      },
      signOut: async () => {
        // Clear demo flag and redirect to login
        try {
          localStorage.removeItem("flag.demoMode");
        } catch {}
        window.location.href = "/login";
      },
      refreshToken: async () => {
        console.info("[Demo Mode] Token refresh is a no-op in demo mode");
      },
    }),
    []
  );

  // If demo mode is not enabled, just render children normally
  // (the real AuthProvider will handle authentication)
  if (!enabled) {
    return children;
  }

  // Override the AuthContext with demo values
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default DemoModeAuthProvider;
