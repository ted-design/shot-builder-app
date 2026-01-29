import { Component } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "../lib/toast";

const CHUNK_RELOAD_KEY = "chunk-reload-attempted";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    // Detect chunk loading errors
    const isChunkError = ErrorBoundary.isChunkLoadError(error);
    return { hasError: true, isChunkError };
  }

  static isChunkLoadError(error) {
    const message = error?.message || "";
    return (
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed") ||
      message.includes("ChunkLoadError") ||
      message.includes("Loading chunk") ||
      message.includes("Failed to fetch") && message.includes("import")
    );
  }

  componentDidCatch(error, info) {
    console.error("Unhandled error", error, info);

    // Check if this is a chunk loading error and we haven't reloaded yet
    const isChunkError = ErrorBoundary.isChunkLoadError(error);
    const hasReloadedBefore = sessionStorage.getItem(CHUNK_RELOAD_KEY) === "true";

    if (isChunkError && !hasReloadedBefore) {
      // Mark that we've attempted a reload
      sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");

      console.log("Chunk load error detected. Reloading page to fetch latest code...");

      // Report to Sentry as info (not error) since this is expected during deployments
      Sentry.captureMessage("Auto-reloading due to chunk load error", {
        level: "info",
        contexts: {
          error: {
            message: error.message,
            stack: error.stack,
          },
        },
      });

      // Reload the page to get fresh code
      window.location.reload();
      return;
    }

    // Clear the reload flag if we got here (successful reload or non-chunk error)
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);

    // Report error to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack,
        },
      },
    });

    toast.error({ title: "Something went wrong", description: error?.message || "Unexpected error" });
  }

  handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center text-slate-700">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600">
              The app hit an unexpected error. You can try refreshing the page to continue.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-primary-dark"
          >
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
