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
    return event;
  },
});

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
