/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom"
import { NotFoundPage } from "@/shared/components/NotFoundPage"

// The bare-project and /inbox, /library legacy redirects date from the
// Phase 0.1 route cleanup, when their real routes did not exist yet — this
// page was the only thing that could resolve them. /projects/:id/schedules
// is different: commit 9801e4fa registered the route for real, so any
// request that lands here for that path has already failed to match the
// live route (typo'd id, genuinely missing project, etc.) and redirecting
// it to /callsheet — a DIFFERENT surface — would silently send the user
// somewhere they didn't ask for. Confirms it stays a real 404.
//
// The catch-all here is deliberately just NotFoundPage, same as production
// (see routes/index.tsx) — a redirect target that doesn't match a real route
// falls straight back through it. Reading the resolved pathname (rather than
// asserting "Page Not Found" is absent) is what makes that visible: a still-
// live bareSchedules redirect would resolve to /projects/p1/callsheet, which
// ALSO doesn't match a route here and re-renders NotFoundPage — so an
// absence-of-heading assertion can't tell the two cases apart, only the
// captured pathname can.
describe("NotFoundPage legacy redirects", () => {
  function capturedPathnameAt(path: string) {
    let pathname: string | undefined
    function PathnameObserver() {
      pathname = useLocation().pathname
      return null
    }
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <PathnameObserver />
      </MemoryRouter>,
    )
    return () => pathname
  }

  it("does not redirect /projects/:id/schedules — that route is live, not legacy", () => {
    const pathname = capturedPathnameAt("/projects/p1/schedules")
    expect(pathname()).toBe("/projects/p1/schedules")
    expect(screen.getByText("Page Not Found")).toBeInTheDocument()
  })

  it("still redirects the bare project route to /shots", () => {
    const pathname = capturedPathnameAt("/projects/p1")
    expect(pathname()).toBe("/projects/p1/shots")
  })

  it("still redirects /inbox to /requests", () => {
    const pathname = capturedPathnameAt("/inbox")
    expect(pathname()).toBe("/requests")
  })

  it("still redirects /library to /library/talent", () => {
    const pathname = capturedPathnameAt("/library")
    expect(pathname()).toBe("/library/talent")
  })
})
