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

// ---------------------------------------------------------------------------
// Module-import-failure telemetry (production only, once per session)
// ---------------------------------------------------------------------------
const MODULE_TELEMETRY_KEY = 'telemetry:module-import-failed:sent';
const IS_PRODUCTION = import.meta.env.MODE === 'production';

function isModuleImportError(msg) {
  if (!msg) return false;
  return (
    msg.includes('Importing a module script failed') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes("Unexpected token '<'") ||
    msg.includes('ChunkLoadError')
  );
}

/** Return the most-likely failing /assets/*.js URL from Resource Timing. */
function guessSuspectAssetUrl() {
  try {
    const entries = performance
      .getEntriesByType('resource')
      .filter((e) => typeof e.name === 'string' && /\/assets\/.*\.js/.test(e.name));

    // Suspect: transferSize === 0 with some duration (possible blocked / wrong content-type)
    const suspect = [...entries]
      .reverse()
      .find(
        (e) =>
          (e.transferSize === 0 && e.duration > 0) ||
          (e.encodedBodySize === 0 && e.duration > 0)
      );
    if (suspect) return suspect.name;

    // Fallback: last loaded /assets/*.js
    return entries.length > 0 ? entries[entries.length - 1].name : null;
  } catch {
    return null;
  }
}

/** Best-effort probe of a same-origin URL: HEAD then Range-GET. */
async function probeAssetUrl(url) {
  if (!url) return null;
  try {
    const origin = window.location.origin;
    if (!url.startsWith(origin)) return { skipped: true, reason: 'cross-origin' };

    // Try HEAD first
    try {
      const headResp = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return {
        method: 'HEAD',
        status: headResp.status,
        contentType: headResp.headers.get('content-type'),
      };
    } catch {
      // HEAD blocked (e.g. service worker), fall through to Range GET
    }

    // Range GET – read first 256 bytes
    const getResp = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Range: 'bytes=0-255' },
    });
    const snippet = (await getResp.text()).slice(0, 120);
    return {
      method: 'GET-range',
      status: getResp.status,
      contentType: getResp.headers.get('content-type'),
      bodySnippet: snippet,
    };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Fire rich Sentry telemetry for a module import failure.
 * Runs at most once per browser session and only in production.
 */
async function fireModuleImportTelemetry(errorMessage, errorStack, scriptSrc) {
  if (!IS_PRODUCTION) return;
  try {
    if (sessionStorage.getItem(MODULE_TELEMETRY_KEY)) return;
    sessionStorage.setItem(MODULE_TELEMETRY_KEY, '1');
  } catch {
    // sessionStorage unavailable (private mode edge case) — proceed anyway
  }

  const suspectUrl =
    scriptSrc ||
    errorMessage?.match?.(/https?:\/\/[^\s'"]+/)?.[0] ||
    guessSuspectAssetUrl();

  const recentAssets = getRecentAssetResourceTimings(30);
  const probeResult = await probeAssetUrl(suspectUrl);

  Sentry.captureMessage('MODULE_IMPORT_TELEMETRY', {
    level: 'error',
    tags: {
      telemetry_type: 'module_import_failed',
      suspect_url: suspectUrl ? suspectUrl.replace(/.*\/assets\//, '/assets/') : 'unknown',
      is_ios: String(isIOS),
      is_safari: String(isSafari),
      route: window.location.pathname,
    },
    contexts: {
      module_error: {
        message: errorMessage,
        stack: errorStack?.slice?.(0, 2000),
        scriptSrc: scriptSrc || null,
      },
      probe: probeResult,
      environment: {
        href: window.location.href,
        origin: window.location.origin,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        visibility: document.visibilityState,
        onLine: navigator.onLine,
      },
    },
    extra: {
      recentAssets,
      suspectUrl,
    },
  });
}

// Capture-phase error listener: catches <script> / module load failures that
// don't surface as unhandled rejections (e.g. <script type="module" src="...">
// returning HTML). Only fires in production once per session.
if (IS_PRODUCTION && typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      // Only interested in resource/script load errors (not runtime JS errors)
      const target = event?.target;
      if (!target || target === window) return; // runtime error, ignore

      const tagName = (target.tagName || '').toLowerCase();
      if (tagName !== 'script' && tagName !== 'link') return;

      const src = target.src || target.href || '';
      if (!src.includes('/assets/')) return;

      fireModuleImportTelemetry(
        `Resource load error: ${tagName} ${src}`,
        null,
        src
      );
    },
    true // capture phase — fires before default handlers
  );
}

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
  const reason = event.reason;
  const msg = reason?.message || String(reason || '');

  // Fire deep telemetry for module import failures (once per session, prod only)
  if (isModuleImportError(msg)) {
    fireModuleImportTelemetry(msg, reason?.stack, null);
  }

  if (isChunkLoadError(reason)) {
    const hasReloadedBefore = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "true";

    if (!hasReloadedBefore) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
      console.log("Chunk load error detected (unhandled rejection). Reloading page...");

      Sentry.captureMessage("Auto-reloading due to chunk load error (unhandled rejection)", {
        level: "info",
        contexts: {
          error: {
            message: reason?.message,
            stack: reason?.stack,
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

// Signal that React has mounted — disables pre-React fallback UI
window.__BOOT_PHASE = 'react-mounted';
