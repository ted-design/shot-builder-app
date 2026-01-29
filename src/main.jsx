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

// Build identifier injected by Vite at build time (git SHA or timestamp)
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

// Log build ID for diagnostics (visible in browser DevTools console)
console.info(`[ShotBuilder] build=${BUILD_ID} env=${import.meta.env.MODE}`);

// Detect iOS Safari for Sentry tagging
const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

// Initialize Sentry for error tracking
Sentry.init({
  dsn: "https://a56224a78678d4aca8e608ecb45d7f57@o4510145413447680.ingest.us.sentry.io/4510145414955008",
  environment: import.meta.env.MODE, // 'development' or 'production'
  release: `shot-builder@${BUILD_ID}`,

  // Performance Monitoring
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Attach build and device tags to every event
  initialScope: {
    tags: {
      build_id: BUILD_ID,
      is_ios: String(isIOS),
      is_safari: String(isSafari),
    },
  },

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

    // Attach current route to every event
    event.tags = event.tags || {};
    event.tags.route = window.location.pathname;

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

// --- Boot diagnostics: flush pre-React errors to Sentry ---
function flushBootErrorsToSentry() {
  const bootErrors = window.__BOOT_ERRORS || [];
  if (bootErrors.length === 0) return;

  for (const entry of bootErrors) {
    if (entry.type === 'html_served_for_js') {
      Sentry.captureMessage('Asset request returned HTML (SPA rewrite likely misconfigured)', {
        level: 'error',
        tags: {
          boot_phase: 'pre-react',
          route: entry.route,
          is_ios_safari: String(!!window.__IS_IOS_SAFARI),
        },
        contexts: {
          boot_error: {
            src: entry.src,
            http_status: entry.status,
            response_snippet: entry.snippet,
          },
        },
      });
    } else if (entry.type === 'resource_load_error') {
      Sentry.captureMessage('BOOT_ASSET_LOAD_FAIL', {
        level: 'error',
        tags: {
          boot_phase: 'pre-react',
          route: entry.route,
          asset_url: entry.src,
          resource_tag: entry.tagName,
          status: String(entry.probeStatus ?? 'unknown'),
          content_type: String(entry.probeContentType ?? 'unknown'),
          is_ios: String(!!entry.isIOS),
          is_safari: String(!!entry.isSafari),
        },
        contexts: {
          boot_error: {
            src: entry.src,
            message: entry.message,
            probe_status: entry.probeStatus,
            probe_content_type: entry.probeContentType,
            probe_snippet: entry.probeSnippet,
          },
        },
      });
    } else if (entry.type === 'module_import_rejection') {
      Sentry.captureMessage('BOOT_ASSET_LOAD_FAIL', {
        level: 'error',
        tags: {
          boot_phase: 'pre-react',
          route: entry.route,
          asset_url: entry.message?.match?.(/https?:\/\/[^\s'"]+/)?.[0] || 'unknown',
          status: String(entry.probeStatus ?? 'unknown'),
          content_type: String(entry.probeContentType ?? 'unknown'),
          is_ios: String(!!entry.isIOS),
          is_safari: String(!!entry.isSafari),
        },
        contexts: {
          boot_error: {
            message: entry.message,
            stack: entry.stack,
            probe_status: entry.probeStatus,
            probe_content_type: entry.probeContentType,
            probe_snippet: entry.probeSnippet,
          },
        },
      });
    } else if (entry.type === 'js_error') {
      Sentry.captureMessage(`Pre-React JS error: ${entry.message}`, {
        level: 'warning',
        tags: {
          boot_phase: 'pre-react',
          route: entry.route,
        },
        contexts: {
          boot_error: {
            filename: entry.filename,
            lineno: entry.lineno,
            colno: entry.colno,
          },
        },
      });
    }
  }

  // Clear after flushing
  window.__BOOT_ERRORS = [];
}

// Record the asset manifest as a Sentry breadcrumb for diagnostics.
// This tells us exactly which hashed filenames the shell is pointing at.
const manifest = window.__BOOT_ASSET_MANIFEST;
if (manifest) {
  Sentry.addBreadcrumb({
    category: 'boot',
    message: 'Asset manifest from shell HTML',
    level: 'info',
    data: {
      module_entry: manifest.moduleEntry,
      preload_0: manifest.preloads[0] || null,
      preload_1: manifest.preloads[1] || null,
      preload_2: manifest.preloads[2] || null,
    },
  });
}

// Flush boot errors now that Sentry is initialized.
// Delay slightly to allow async fetch probes (in index.html) to populate
// status/content-type/snippet fields on boot error entries.
setTimeout(flushBootErrorsToSentry, 2000);

// Global handler for chunk loading errors (catches errors outside React error boundary)
const CHUNK_RELOAD_KEY = "chunk-reload-attempted";

function isChunkLoadError(error) {
  const message = error?.message || "";
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
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

// Signal that React has mounted — disables pre-React fallback UI
window.__BOOT_PHASE = 'react-mounted';
