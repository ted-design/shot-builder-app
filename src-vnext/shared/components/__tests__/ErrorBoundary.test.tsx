/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"

// ErrorBoundary renders `Build {__BUILD_ID__}` in its fallback footer. The
// Vite define is only applied in the app build — under Vitest the symbol is
// undefined and would throw ReferenceError. Stub it globally for every test.
beforeEach(() => {
  vi.stubGlobal("__BUILD_ID__", "test-build-abc")
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/**
 * A child that throws synchronously during render. Used to trigger the
 * boundary. `message` is controlled so we can exercise the chunk-load
 * detection branch.
 */
function Boom({ message = "boom" }: { message?: string }): never {
  throw new Error(message)
}

/**
 * A child that throws with a custom error `name` (e.g. "ChunkLoadError"),
 * used to exercise the `name.includes("chunkload")` branch of
 * `isLikelyChunkLoadError`.
 */
function BoomWithName({
  name,
  message = "dynamic import failed",
}: {
  name: string
  message?: string
}): never {
  const err = new Error(message)
  err.name = name
  throw err
}

/**
 * A stateful child whose throwing behavior is driven by a prop. Used by the
 * "Try again" reset test so we can first error, reset the boundary, then
 * rerender with `shouldThrow=false` to verify the children path is taken
 * again after state clears.
 */
function ToggleBoom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("toggled boom")
  }
  return <div>Fine</div>
}

describe("ErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    // Silence is not required for the happy path, but keep the spy so any
    // unexpected error log would surface as a test failure instead of noise.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <div>OK</div>
      </ErrorBoundary>,
    )

    expect(screen.getByText("OK")).toBeInTheDocument()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("renders the default fallback UI when a child throws", () => {
    // React's error boundary machinery always logs the caught error via
    // console.error in development. Silence it to keep test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom message="boom" />
      </ErrorBoundary>,
    )

    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument()
    // The raw error message is surfaced in the default fallback.
    expect(screen.getByText("boom")).toBeInTheDocument()
    // Default fallback always offers a "Try again" action.
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument()
  })

  it("renders a custom `fallback` prop when provided instead of the default UI", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary fallback={<div>Custom</div>}>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByText("Custom")).toBeInTheDocument()
    // Default heading must NOT appear — the custom fallback replaces it.
    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument()
  })

  it("clicking 'Try again' resets internal state so children can render again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const user = userEvent.setup()

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleBoom shouldThrow={true} />
      </ErrorBoundary>,
    )

    // Boundary caught the error — default fallback is visible.
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument()

    // Rerender with a non-throwing child FIRST so that when handleReset
    // triggers a re-render of the boundary's subtree, the next child render
    // does not throw again and flip state back to hasError. The boundary
    // still shows the fallback at this point because internal state is
    // still {hasError: true}.
    rerender(
      <ErrorBoundary>
        <ToggleBoom shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument()

    // Now click "Try again" → handleReset clears hasError → children render.
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(screen.getByText("Fine")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).not.toBeInTheDocument()
  })

  it("shows 'Reload required' heading and 'Reload app' button for chunk-load errors (message match)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom message="Loading chunk 42 failed" />
      </ErrorBoundary>,
    )

    expect(
      screen.getByRole("heading", { name: "Reload required" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Reload app" }),
    ).toBeInTheDocument()
    // "Try again" is still offered alongside reload.
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument()
    // The generic "Something went wrong" heading must NOT appear.
    expect(
      screen.queryByRole("heading", { name: "Something went wrong" }),
    ).not.toBeInTheDocument()
  })

  it("detects chunk-load errors via error.name === 'ChunkLoadError'", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BoomWithName name="ChunkLoadError" message="anything" />
      </ErrorBoundary>,
    )

    expect(
      screen.getByRole("heading", { name: "Reload required" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Reload app" }),
    ).toBeInTheDocument()
  })

  it("hides 'Reload app' button for non-chunk-load errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom message="normal" />
      </ErrorBoundary>,
    )

    expect(
      screen.queryByRole("button", { name: "Reload app" }),
    ).not.toBeInTheDocument()
    // Default path still renders Try again.
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument()
  })

  it("logs caught errors via console.error with '[ErrorBoundary]' tag in componentDidCatch", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom message="tagged" />
      </ErrorBoundary>,
    )

    // React also logs its own internal errors; filter to the boundary's own
    // tagged call. componentDidCatch is called with ("[ErrorBoundary]", error, errorInfo).
    const taggedCalls = errorSpy.mock.calls.filter(
      (call) => call[0] === "[ErrorBoundary]",
    )
    expect(taggedCalls.length).toBeGreaterThanOrEqual(1)
    // The logged error should be the one we threw.
    expect(taggedCalls[0]?.[1]).toBeInstanceOf(Error)
    expect((taggedCalls[0]?.[1] as Error).message).toBe("tagged")
  })

  it("renders the build id in the fallback footer", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Boom message="anything" />
      </ErrorBoundary>,
    )

    // The footer renders "Build {__BUILD_ID__}". With our stub it should
    // appear as "Build test-build-abc". Use a regex matcher so whitespace
    // handling in the component template doesn't break the assertion.
    expect(screen.getByText(/Build\s+test-build-abc/)).toBeInTheDocument()
  })
})
