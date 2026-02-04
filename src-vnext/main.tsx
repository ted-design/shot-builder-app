import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../tokens.css"
import "./index.css"
import { App } from "@/app/App"

declare global {
  interface Window {
    __BOOT_PHASE?: string
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
