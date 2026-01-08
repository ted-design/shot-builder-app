/**
 * PlaywrightAuthProvider
 *
 * When Playwright auth bypass is active (VITE_PLAYWRIGHT_AUTH_BYPASS=true in DEV mode only),
 * this provider bypasses Firebase Auth and provides synthetic credentials for UI screenshot capture.
 *
 * SECURITY: This bypass is IMPOSSIBLE in production builds because:
 * 1. The env var check requires import.meta.env.DEV to be true
 * 2. Vite strips import.meta.env.DEV to false in production builds
 * 3. The entire provider is a no-op when not in dev mode
 *
 * The bypass user has:
 * - clientId: "unbound-merino" (to access real data)
 * - role: "producer" (full UI access for screenshot capture)
 * - email: "dev@local.test" (fixed dev user)
 */
import { useMemo } from "react";
import { AuthContext } from "./AuthContext";

// Playwright bypass user configuration
const PLAYWRIGHT_CONFIG = {
  clientId: "unbound-merino",
  role: "producer",
  user: {
    uid: "playwright-test-user",
    displayName: "Playwright Test User",
    email: "dev@local.test",
    photoURL: null,
    emailVerified: true,
    // Mock Firebase User methods that components might call
    getIdToken: async () => "playwright-test-token",
    getIdTokenResult: async () => ({
      claims: {
        role: "producer",
        clientId: "unbound-merino",
        isPlaywrightBypass: true,
      },
    }),
  },
};

/**
 * Check if Playwright auth bypass is active.
 * This is ONLY possible in development mode.
 *
 * @returns {boolean} True if bypass is active and allowed
 */
export function isPlaywrightAuthBypassActive() {
  // CRITICAL: Only allow bypass in development mode
  // In production builds, import.meta.env.DEV is statically replaced with false
  // and this entire check becomes: if (false) { ... }
  if (!import.meta.env.DEV) {
    return false;
  }

  // Check for the bypass flag
  const bypassEnv = import.meta.env.VITE_PLAYWRIGHT_AUTH_BYPASS;
  if (!bypassEnv) {
    return false;
  }

  const normalized = String(bypassEnv).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/**
 * Wraps children with a synthetic AuthContext when Playwright bypass is enabled.
 * When not enabled, simply renders children (real AuthProvider handles auth).
 */
export function PlaywrightAuthProvider({ children }) {
  const isActive = isPlaywrightAuthBypassActive();

  const value = useMemo(
    () => ({
      user: PLAYWRIGHT_CONFIG.user,
      initializing: false,
      loadingClaims: false,
      ready: true,
      claims: {
        role: PLAYWRIGHT_CONFIG.role,
        clientId: PLAYWRIGHT_CONFIG.clientId,
        isPlaywrightBypass: true,
      },
      role: PLAYWRIGHT_CONFIG.role,
      clientId: PLAYWRIGHT_CONFIG.clientId,
      projectRoles: {},
      claimsError: null,
      signIn: async () => {
        console.info("[Playwright Bypass] Sign-in is bypassed in Playwright mode");
      },
      signOut: async () => {
        console.info("[Playwright Bypass] Sign-out is a no-op in Playwright mode");
      },
      refreshToken: async () => {
        console.info("[Playwright Bypass] Token refresh is a no-op in Playwright mode");
      },
    }),
    []
  );

  // If bypass is not active, just render children normally
  // (the real AuthProvider will handle authentication)
  if (!isActive) {
    return children;
  }

  // Log that bypass is active (helpful for debugging)
  console.info("[Playwright Bypass] Auth bypass is ACTIVE - using test user:", PLAYWRIGHT_CONFIG.user.email);

  // Override the AuthContext with bypass values
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default PlaywrightAuthProvider;
