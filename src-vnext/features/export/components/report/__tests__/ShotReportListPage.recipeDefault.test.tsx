/// <reference types="@testing-library/jest-dom" />
// H2b — the flag-off clamp on the CREATE path. ShotReportListPage.handleCreate
// picks between `{ ...DEFAULT_REPORT_CONFIG, layout: recipe }` (recipes ON) and
// the shared `resolveReportLayout` clamp (recipes OFF). Nothing exercised the
// OFF branch end-to-end: this renders the real page, clicks Create with the
// flag off, and asserts the write handed to createShotReport carries
// layout:"image-led" — never DEFAULT_REPORT_CONFIG's current "production-sheet"
// default. Mutation check: swapping the OFF branch for a raw
// `{ ...DEFAULT_REPORT_CONFIG }` spread must redden this test.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import ShotReportListPage from "../ShotReportListPage"

const createShotReportMock = vi.hoisted(() => vi.fn().mockResolvedValue("report-new"))
// Stable stubs (module-level, not recreated per-render) — see the identity
// note in ShotReportPage.legacyHydrate.test.tsx for why a fresh vi.fn() per
// render is a hazard elsewhere in this page family.
const loadReportMock = vi.hoisted(() => vi.fn())
const deleteReportMock = vi.hoisted(() => vi.fn())
const renameReportMock = vi.hoisted(() => vi.fn())

vi.mock("../../../hooks/useExportReports", () => ({
  useExportReports: () => ({
    reports: [],
    loading: false,
    createShotReport: createShotReportMock,
    loadReport: loadReportMock,
    deleteReport: deleteReportMock,
    renameReport: renameReportMock,
  }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "client-1", role: "producer" }),
}))

// featureShotReportRecipes pinned OFF for this file (the contract under test);
// everything else falls through to the real flag module.
vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
      flag === "featureShotReportRecipes" ? false : actual.isFeatureEnabled(flag),
  }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/proj-1/export/reports"]}>
      <Routes>
        <Route path="/projects/:id/export/reports" element={<ShotReportListPage />} />
        {/* openReport() navigates here after create — route it to avoid a
            "no routes matched" router warning; the test asserts on the
            create write, not the destination page. */}
        <Route path="/projects/:id/export/report" element={<div>Report route</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ShotReportListPage create — featureShotReportRecipes OFF (H2b)", () => {
  beforeEach(() => {
    createShotReportMock.mockClear()
  })

  it("the create write's layout is image-led, not DEFAULT_REPORT_CONFIG's production-sheet default", async () => {
    const user = userEvent.setup()
    renderPage()

    // Recipe picker is hidden while the flag is off (showLayout=recipesEnabled).
    expect(screen.queryByLabelText("Report recipe")).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("New report name"), "Q3 warehouse sheet")
    await user.click(screen.getByRole("button", { name: /create report/i }))

    expect(createShotReportMock).toHaveBeenCalledTimes(1)
    const [, config] = createShotReportMock.mock.calls[0] as [string, { layout?: string }]
    expect(config.layout).toBe("image-led")
  })
})
