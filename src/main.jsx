import "./bootstrap/flagUrl";
import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import { FLAGS } from "./lib/flags";
import AuthProviderGated from "./context/AuthProviderGated";
import AuthDebugBadge from "./components/AuthDebugBadge";
import ErrorBoundary from "./components/ErrorBoundary";
import ToastProvider from "./components/ui/ToastProvider";
import "./index.css";

// Runtime validation: Ensure React is properly initialized
// This catches module loading issues in production builds where React
// might not be available when components using forwardRef are evaluated
if (typeof React === 'undefined' || typeof React.forwardRef === 'undefined') {
  const errorMsg = 'React not properly initialized. This indicates a build configuration issue. Check Vite config and chunk loading order.';
  console.error(errorMsg);

  // Log to Sentry if available
  if (typeof Sentry !== 'undefined') {
    Sentry.captureMessage(errorMsg, { level: 'fatal' });
  }

  // Show user-friendly error
  document.getElementById('root').innerHTML = `
    <div style="padding: 40px; font-family: system-ui; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #dc2626;">Application Error</h1>
      <p>The application failed to initialize properly. Please try refreshing the page.</p>
      <p style="color: #6b7280; font-size: 14px;">Error: React module not loaded</p>
      <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;">
        Reload Page
      </button>
    </div>
  `;

  throw new Error(errorMsg);
}

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://a56224a78678d4aca8e608ecb45d7f57@o4510145413447680.ingest.us.sentry.io/4510145414955008",
  environment: import.meta.env.MODE, // 'development' or 'production'

  // Performance Monitoring
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Performance monitoring sample rate (10% of transactions)
  tracesSampleRate: 0.1,

  // Session replay sample rate
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Only send errors in production to reduce noise
  beforeSend(event, hint) {
    // In development, log to console but don't send to Sentry
    if (import.meta.env.MODE === 'development') {
      console.log('Sentry event (dev mode, not sent):', event, hint);
      return null;
    }

    // Filter out benign IndexedDB errors from Firebase Auth persistence
    // These occur when navigating away during auth state changes and are non-actionable
    // See: https://github.com/nicolo-ribaudo/idb/issues/295
    const error = hint?.originalException;
    if (
      error instanceof DOMException &&
      error.name === 'InvalidStateError' &&
      error.message?.includes('database connection is closing')
    ) {
      return null;
    }

    // Also check exception values for the same error pattern
    const exceptionValues = event?.exception?.values;
    if (exceptionValues?.some((ex) =>
      ex.type === 'InvalidStateError' &&
      ex.value?.includes('database connection is closing')
    )) {
      return null;
    }

    return event;
  },
});

const bootContext = {
  href: window.location.href,
  path: window.location.pathname,
  referrer: document.referrer,
  userAgent: navigator.userAgent,
  visibility: document.visibilityState,
  timeOrigin: performance.timeOrigin,
};

console.info("[Boot] App bootstrap", bootContext);
Sentry.addBreadcrumb({
  category: "boot",
  message: "App bootstrap",
  level: "info",
  data: bootContext,
});

function isModuleScriptImportFailure(event) {
  const message = event?.message || "";
  return message.includes("Importing a module script failed");
}

function getRecentAssetResourceTimings(limit = 10) {
  try {
    return performance
      .getEntriesByType("resource")
      .filter((entry) => typeof entry?.name === "string" && entry.name.includes("/assets/"))
      .slice(-limit)
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        duration: Math.round(entry.duration),
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      }));
  } catch (error) {
    return null;
  }
}

window.addEventListener(
  "error",
  (event) => {
    if (!isModuleScriptImportFailure(event)) return;
    const target = event?.target;
    const requestUrl =
      target?.src ||
      target?.currentSrc ||
      target?.href ||
      event?.filename ||
      null;

    Sentry.captureMessage("Module script import failed", {
      level: "error",
      extra: {
        message: event?.message,
        requestUrl,
        location: window.location.href,
        recentAssets: getRecentAssetResourceTimings(10),
      },
    });
  },
  true
);

// Global handler for chunk loading errors (catches errors outside React error boundary)
const CHUNK_RELOAD_KEY = "chunk-reload-attempted";

function isChunkLoadError(error) {
  const message = error?.message || "";
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    (message.includes("Failed to fetch") && message.includes("import"))
  );
}

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    const hasReloadedBefore = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "true";

    if (!hasReloadedBefore) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
      console.log("Chunk load error detected (unhandled rejection). Reloading page...");

      Sentry.captureMessage("Auto-reloading due to chunk load error (unhandled rejection)", {
        level: "info",
        contexts: {
          error: {
            message: event.reason?.message,
            stack: event.reason?.stack,
          },
        },
        extra: {
          location: window.location.href,
          recentAssets: getRecentAssetResourceTimings(10),
        },
      });

      event.preventDefault();
      window.location.reload();
    }
  }
});

const rootEl = document.getElementById("root");

function Root() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProviderGated>
          <App />
          {/* Gated debug badge: requires flag and ?authBadge=1 */}
          {FLAGS.newAuthContext && <AuthDebugBadge />}
        </AuthProviderGated>
      </ToastProvider>
    </ErrorBoundary>
  );
}

createRoot(rootEl).render(<Root />);
