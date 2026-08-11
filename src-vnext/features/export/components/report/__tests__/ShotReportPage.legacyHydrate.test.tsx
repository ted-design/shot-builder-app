/// <reference types="@testing-library/jest-dom" />
// H3 — a saved shot-report doc with NO `config` field at all (a genuinely
// pre-R3 doc) must hydrate to LEGACY_REPORT_LAYOUT ("image-led"), never to
// DEFAULT_REPORT_CONFIG's current "production-sheet" default, and the NEXT
// save must persist that floor. The no-config branch previously called
// `setConfig(DEFAULT_REPORT_CONFIG)` directly (bypassing hydrateReportConfig's
// layout floor), so a legacy doc opened after the 2026-08-09 default-recipe
// change would silently pick up production-sheet and re-persist it on the
// next edit. Mutation check: reverting the no-config branch to
// `DEFAULT_REPORT_CONFIG` (instead of `hydrateReportConfig(loaded ?? {})`)
// must redden this test.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import ShotReportPage from "../ShotReportPage"
import type { ExportReportFull } from "../../../hooks/useExportReports"

// IMPORTANT: every value handed back by these two mocked hooks must be
// REFERENTIALLY STABLE across renders (module-level, not a fresh object/fn
// literal inside the mock factory's returned closure). ShotReportPage's
// hydrate effect depends on `[reportId, loadReport]` and its image-resolve
// effect depends on `[model]` (derived from `data`) — a `loadReport` or
// `data` that changes identity every render re-fires those effects, which
// call setState, which re-renders, which produces a new identity: an
// infinite loop that OOMs the test worker rather than failing loudly. Caught
// empirically (heap exhaustion) before landing this file.
const loadReportMock = vi.hoisted(() => vi.fn())
const saveReportConfigMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const exportDataStub = vi.hoisted(() => ({
  project: { id: "p1", name: "Legacy Project", client: "unbound-merino" },
  shots: [],
  productFamilies: [],
  pulls: [],
  crew: [],
  talent: [],
  loading: false,
}))

// A genuinely pre-R3 doc: reportType is "shot-report" but `config` is entirely
// absent (never written by the pre-recipes builder).
const legacyDoc: ExportReportFull = {
  id: "r1",
  name: "Legacy report",
  reportType: "shot-report",
  layout: "image-led",
  schemaVersion: 1,
  updatedAt: null,
  createdBy: "u1",
  pages: [],
  settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
  customVariables: [],
  config: undefined,
}
loadReportMock.mockResolvedValue(legacyDoc)

vi.mock("../../../hooks/useExportReports", () => ({
  useExportReports: () => ({
    loadReport: loadReportMock,
    saveReportConfig: saveReportConfigMock,
  }),
}))

vi.mock("../../../hooks/useExportData", () => ({
  useExportData: () => exportDataStub,
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "client-1", role: "producer" }),
}))

// featureShotReportRecipes OFF for this file (the H3 contract as specified);
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
    <MemoryRouter initialEntries={["/projects/proj-1/export/report?reportId=r1"]}>
      <Routes>
        <Route path="/projects/:id/export/report" element={<ShotReportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ShotReportPage — legacy no-config doc hydrates to image-led (H3)", () => {
  beforeEach(() => {
    saveReportConfigMock.mockClear()
  })

  it("persists layout:image-led on the next save, never production-sheet", async () => {
    const user = userEvent.setup()
    renderPage()

    // Wait for the hydrate effect's loadReport().then(...) to resolve and for
    // the control bar (screen render) to mount.
    const noneButton = await screen.findByRole("button", { name: "None" })
    await user.click(noneButton)

    await waitFor(() => expect(saveReportConfigMock).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    })
    const [, savedConfig] = saveReportConfigMock.mock.calls[0] as [
      string,
      { layout?: string; groupBy?: string },
    ]
    expect(savedConfig.layout).toBe("image-led")
    expect(savedConfig.groupBy).toBe("none")
  })
})
