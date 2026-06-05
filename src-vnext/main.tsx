import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import * as Sentry from "@sentry/react"
import "../tokens.css"
import "./index.css"
import { App } from "@/app/App"

interface BootError {
  readonly type?: string
  readonly message?: string
}

declare global {
  interface Window {
    __BOOT_PHASE?: string
    __BOOT_ERRORS?: BootError[]
  }
}

if (import.meta.env.VITE_SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      release: typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : undefined,
      integrations: [Sentry.replayIntegration()],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    })

    if (Array.isArray(window.__BOOT_ERRORS)) {
      for (const entry of window.__BOOT_ERRORS) {
        if (entry instanceof Error) {
          Sentry.captureException(entry)
        } else {
          Sentry.captureMessage(entry?.message ?? entry?.type ?? "Boot error", {
            level: "error",
            extra: { bootError: entry },
          })
        }
      }
      window.__BOOT_ERRORS = []
    }
  } catch (err) {
    console.error("[Sentry] initialization failed:", err)
  }
}

const root = document.getElementById("root")
if (!root) {
  throw new Error("Root element not found")
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

window.__BOOT_PHASE = "react-mounted"
