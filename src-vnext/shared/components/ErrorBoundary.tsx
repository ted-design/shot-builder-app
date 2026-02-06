import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/ui/button"

interface Props {
  readonly children: ReactNode
  readonly fallback?: ReactNode
}

interface State {
  readonly hasError: boolean
  readonly error: Error | null
}

function isLikelyChunkLoadError(error: Error | null): boolean {
  if (!error) return false
  const message = (error.message ?? "").toLowerCase()
  const name = (error.name ?? "").toLowerCase()

  if (name.includes("chunkload")) return true

  return (
    message.includes("loading chunk") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("unexpected token '<'") ||
    message.includes("unexpected token <")
  )
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    if (typeof window === "undefined") return
    window.location.reload()
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const isChunkLoad = isLikelyChunkLoadError(this.state.error)
      const message =
        this.state.error?.message ?? "An unexpected error occurred."

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {isChunkLoad ? "Reload required" : "Something went wrong"}
          </h2>
          <p className="max-w-md text-sm text-[var(--color-text-muted)]">
            {isChunkLoad
              ? "A required part of the app failed to load. This can happen after an update or on an unstable connection. Reload to continue."
              : message}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              Try again
            </Button>
            {isChunkLoad && (
              <Button onClick={this.handleReload}>
                Reload app
              </Button>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-subtle)]">
            Build {__BUILD_ID__}
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
