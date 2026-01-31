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

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Something went wrong
          </h2>
          <p className="max-w-md text-sm text-[var(--color-text-muted)]">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <Button variant="outline" onClick={this.handleReset}>
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
